import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import {
  BillPayStatus,
  SupplierPaymentCreateInput,
  SupplierPaymentListQuery,
} from "./supplierPayment.schema";

function payStatus(totalPaid: number, billAmount: number): BillPayStatus {
  if (totalPaid <= 0) return "UNPAID";
  if (totalPaid < billAmount) return "PARTIAL";
  return "PAID";
}

export async function list(query: SupplierPaymentListQuery) {
  const where: Prisma.PurchaseBillWhereInput = { status: "CONFIRMED" };
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.from || query.to) {
    where.purchaseDate = {};
    if (query.from) where.purchaseDate.gte = query.from;
    if (query.to) where.purchaseDate.lte = query.to;
  }

  const bills = await prisma.purchaseBill.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      payments: true,
    },
    orderBy: { purchaseDate: "desc" },
  });

  const mapped = bills.map((bill) => {
    const totalPaid = Number(bill.payments.reduce((sum, row) => sum + Number(row.amountPaid), 0).toFixed(2));
    const billAmount = Number(bill.totalAmount);
    return {
      ...bill,
      totalPaid,
      outstanding: Number((billAmount - totalPaid).toFixed(2)),
      paymentStatus: payStatus(totalPaid, billAmount),
    };
  });

  const filtered = query.status ? mapped.filter((row) => row.paymentStatus === query.status) : mapped;
  const start = (query.page - 1) * query.limit;
  const data = filtered.slice(start, start + query.limit);

  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));

  let totalPending = 0;
  let totalPaidThisMonth = 0;
  for (const row of mapped) {
    totalPending += Math.max(0, row.outstanding);
    for (const payment of row.payments) {
      const paidAt = new Date(payment.paymentDate);
      if (paidAt >= monthStart && paidAt < monthEnd) {
        totalPaidThisMonth += Number(payment.amountPaid);
      }
    }
  }

  return {
    data,
    total: filtered.length,
    page: query.page,
    limit: query.limit,
    summary: {
      totalPending: Number(totalPending.toFixed(2)),
      totalPaidThisMonth: Number(totalPaidThisMonth.toFixed(2)),
    },
  };
}

export async function getById(id: string) {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id },
    include: {
      supplier: true,
      payments: { orderBy: { paymentDate: "asc" } },
    },
  });
  if (!bill) throw new AppError("Purchase bill not found", 404, "NOT_FOUND");

  const totalPaid = Number(bill.payments.reduce((sum, row) => sum + Number(row.amountPaid), 0).toFixed(2));
  const billAmount = Number(bill.totalAmount);
  return {
    ...bill,
    totalPaid,
    outstanding: Number((billAmount - totalPaid).toFixed(2)),
    paymentStatus: payStatus(totalPaid, billAmount),
    paymentHistory: bill.payments,
  };
}

export async function create(input: SupplierPaymentCreateInput) {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id: input.purchaseBillId },
    include: { payments: true },
  });
  if (!bill) throw new AppError("Purchase bill not found", 404, "NOT_FOUND");
  if (bill.status !== "CONFIRMED") {
    throw new AppError("Purchase bill must be CONFIRMED before payment", 400, "INVALID_STATUS");
  }

  const totalAlreadyPaid = Number(
    bill.payments.reduce((sum, row) => sum + Number(row.amountPaid), 0).toFixed(2)
  );
  const outstanding = Number((Number(bill.totalAmount) - totalAlreadyPaid).toFixed(2));
  if (input.amountPaid + totalAlreadyPaid > Number(bill.totalAmount)) {
    throw new AppError(`Payment exceeds bill amount. Outstanding: ${outstanding}`, 400, "INVALID_AMOUNT");
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.supplierPayment.create({
      data: {
        purchaseBillId: input.purchaseBillId,
        supplierId: bill.supplierId,
        amountPaid: input.amountPaid,
        paymentDate: input.paymentDate,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo,
        notes: input.notes,
      },
      include: { supplier: true, purchaseBill: true },
    });

    await createLedgerEntry(
      {
        partyId: bill.supplierId,
        description: `Supplier payment against ${bill.billNumber}`,
        referenceType: "SUPPLIER_PAYMENT",
        referenceId: payment.id,
        debitAmount: input.amountPaid,
        creditAmount: 0,
      },
      tx
    );

    const totalPaid = Number((totalAlreadyPaid + input.amountPaid).toFixed(2));
    return {
      ...payment,
      totalPaid,
      outstanding: Number((Number(bill.totalAmount) - totalPaid).toFixed(2)),
      paymentStatus: payStatus(totalPaid, Number(bill.totalAmount)),
    };
  });
}
