import { PaymentStatus, Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { createAuditLog } from "@/utils/auditHelper";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import { deleteLedgerByReference } from "@/utils/stockReverse";
import { isoWeek } from "@/modules/production/shared";
import { KarigarConfirmInput, KarigarListQuery } from "./karigarPayment.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  operation: { select: { id: true, name: true } },
  transactions: {
    orderBy: { paymentDate: "asc" as const },
    select: {
      id: true,
      amountPaid: true,
      paymentDate: true,
      paymentMode: true,
      referenceNo: true,
      notes: true,
    },
  },
} as const;

function derivePaymentStatus(amountDue: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return "PENDING";
  if (amountPaid >= amountDue) return "PAID";
  return "PARTIALLY_PAID";
}

export async function list(query: KarigarListQuery) {
  const where: Prisma.KarigarPaymentWhereInput = {};
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.status) where.status = query.status;
  if (query.weekNumber) where.weekNumber = query.weekNumber;
  if (query.year) where.year = query.year;
  if (query.poId) where.poId = query.poId;

  const { week, year } = isoWeek(new Date());
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));

  const [data, total, dueThisWeek, paidThisMonth, pendingCount] = await prisma.$transaction([
    prisma.karigarPayment.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.karigarPayment.count({ where }),
    prisma.karigarPayment.aggregate({
      where: {
        ...where,
        weekNumber: week,
        year,
        status: { in: ["PENDING", "PARTIALLY_PAID"] },
      },
      _sum: { amountDue: true, amountPaid: true },
    }),
    prisma.karigarPayment.aggregate({
      where: {
        ...where,
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountPaid: true },
    }),
    prisma.karigarPayment.count({
      where: { ...where, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
    }),
  ]);

  const dueGross = Number(dueThisWeek._sum.amountDue ?? 0);
  const duePaid = Number(dueThisWeek._sum.amountPaid ?? 0);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalDueThisWeek: Number((dueGross - duePaid).toFixed(2)),
      totalPaidThisMonth: Number(paidThisMonth._sum.amountPaid ?? 0),
      pendingCount,
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.karigarPayment.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Karigar payment not found", 404, "NOT_FOUND");
  return row;
}

export async function confirm(id: string, input: KarigarConfirmInput, userId?: string) {
  const row = await getById(id);
  if (row.status === "PAID") {
    throw new AppError("Payment is already fully paid", 400, "INVALID_STATUS");
  }

  const amountDue = Number(row.amountDue);
  const alreadyPaid = Number(row.amountPaid);
  const outstanding = Number((amountDue - alreadyPaid).toFixed(2));
  const payAmount = input.amountPaid ?? outstanding;

  if (payAmount <= 0) {
    throw new AppError("Payment amount must be greater than 0", 400, "INVALID_AMOUNT");
  }
  if (payAmount > outstanding) {
    throw new AppError(
      `Payment amount cannot exceed outstanding balance of ${outstanding}`,
      400,
      "INVALID_AMOUNT"
    );
  }

  return prisma.$transaction(async (tx) => {
    const transaction = await tx.karigarPaymentTransaction.create({
      data: {
        karigarPaymentId: row.id,
        karigarId: row.karigarId,
        amountPaid: payAmount,
        paymentDate: input.paymentDate,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo,
        notes: input.notes,
        createdById: userId,
      },
    });

    const newAmountPaid = Number((alreadyPaid + payAmount).toFixed(2));
    const newStatus = derivePaymentStatus(amountDue, newAmountPaid);

    const updated = await tx.karigarPayment.update({
      where: { id },
      data: {
        amountPaid: newAmountPaid,
        status: newStatus,
        paidAt: newStatus === "PAID" ? input.paymentDate : row.paidAt,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo,
      },
      include,
    });

    await createLedgerEntry(
      {
        partyId: row.karigarId,
        description: `Karigar Payment - ${row.operation.name}`,
        referenceType: "KARIGAR_PAYMENT_TXN",
        referenceId: transaction.id,
        debitAmount: 0,
        creditAmount: payAmount,
      },
      tx
    );

    await createAuditLog(
      {
        userId,
        action: "PAYMENT",
        entity: "KarigarPayment",
        entityId: row.id,
        oldValue: { amountPaid: alreadyPaid, status: row.status },
        newValue: {
          amountPaid: newAmountPaid,
          status: newStatus,
          transactionId: transaction.id,
          payAmount,
        },
      },
      tx
    );

    return updated;
  });
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  const row = await getById(id);
  if (Number(row.amountPaid) > 0) {
    throw new AppError("Cannot delete a payment with recorded transactions", 409, "PAYMENT_HAS_TRANSACTIONS");
  }

  await prisma.$transaction(async (tx) => {
    await deleteLedgerByReference(tx, "KARIGAR_PAYMENT", id);
    await tx.karigarPaymentTransaction.deleteMany({ where: { karigarPaymentId: id } });
    await tx.karigarPayment.delete({ where: { id } });
  });
  return { id, message: "Deleted permanently" };
}
