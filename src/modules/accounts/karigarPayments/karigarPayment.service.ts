import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import { isoWeek } from "@/modules/production/shared";
import { KarigarConfirmInput, KarigarListQuery } from "./karigarPayment.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  operation: { select: { id: true, name: true } },
} as const;

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
      where: { ...where, weekNumber: week, year, status: "PENDING" },
      _sum: { amountDue: true },
    }),
    prisma.karigarPayment.aggregate({
      where: {
        ...where,
        status: "PAID",
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountDue: true },
    }),
    prisma.karigarPayment.count({ where: { ...where, status: "PENDING" } }),
  ]);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalDueThisWeek: Number(dueThisWeek._sum.amountDue ?? 0),
      totalPaidThisMonth: Number(paidThisMonth._sum.amountDue ?? 0),
      pendingCount,
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.karigarPayment.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Karigar payment not found", 404, "NOT_FOUND");
  return row;
}

export async function confirm(id: string, input: KarigarConfirmInput) {
  const row = await getById(id);
  if (row.status !== "PENDING") {
    throw new AppError("Only pending payments can be confirmed", 400, "INVALID_STATUS");
  }

  const amountDue = Number(row.amountDue);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.karigarPayment.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: input.paymentDate,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo,
      },
      include,
    });

    await createLedgerEntry(
      {
        partyId: row.karigarId,
        description: `Karigar Payment - ${row.operation.name}`,
        referenceType: "KARIGAR_PAYMENT",
        referenceId: row.id,
        debitAmount: 0,
        creditAmount: amountDue,
      },
      tx
    );

    return updated;
  });
}
