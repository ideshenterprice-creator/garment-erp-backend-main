import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generatePBNumber } from "@/utils/generateId";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import { validateStock } from "@/utils/stockValidator";
import { toCsv } from "@/utils/csv";
import { reverseStockByReference, deleteLedgerByReference } from "@/utils/stockReverse";
import {
  notifyActiveUsers,
  NotificationType,
} from "@/modules/notifications/notification.service";
import {
  PurchaseCreateInput,
  PurchaseListQuery,
  PurchaseRegisterQuery,
  PurchaseReturnInput,
} from "./purchase.schema";

const billInclude = {
  supplier: {
    select: {
      id: true,
      partyNumber: true,
      name: true,
      city: true,
      country: true,
      contact: true,
      type: true,
    },
  },
  product: {
    select: {
      id: true,
      productCode: true,
      name: true,
      category: true,
      unit: true,
      gstRate: true,
    },
  },
  po: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      buyer: { select: { id: true, name: true } },
    },
  },
  payments: true,
} as const;

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function dateRange(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

async function resolveGstPercent(): Promise<number> {
  const rate = await prisma.gSTRate.findFirst({
    where: {
      OR: [
        { applicableOn: { contains: "RAW_MATERIAL", mode: "insensitive" } },
        { applicableOn: { contains: "purchase", mode: "insensitive" } },
        { category: { contains: "RAW_MATERIAL", mode: "insensitive" } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  return rate ? Number(rate.gstPercent) : 0;
}

function paymentTotals(totalAmount: number, payments: Array<{ amountPaid: Prisma.Decimal }>) {
  const totalPaid = round2(payments.reduce((sum, payment) => sum + Number(payment.amountPaid), 0));
  const outstanding = round2(Math.max(0, totalAmount - totalPaid));
  const paymentStatus = totalPaid <= 0 ? "UNPAID" : totalPaid >= totalAmount ? "PAID" : "PARTIAL";
  return { totalPaid, outstanding, paymentStatus: paymentStatus as "PAID" | "PARTIAL" | "UNPAID" };
}

export async function list(query: PurchaseListQuery) {
  const where: Prisma.PurchaseBillWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.poId) where.poId = query.poId;
  const range = dateRange(query.from, query.to);
  if (range) where.purchaseDate = range;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = startOfNextMonth(now);
  const monthWhere: Prisma.PurchaseBillWhereInput = {
    purchaseDate: { gte: monthStart, lt: monthEnd },
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.poId ? { poId: query.poId } : {}),
  };

  const [data, total, totalBillsThisMonth, fabricAgg, pendingApprovalCount] = await prisma.$transaction([
    prisma.purchaseBill.findMany({
      where,
      include: billInclude,
      orderBy: { purchaseDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.purchaseBill.count({ where }),
    prisma.purchaseBill.count({ where: monthWhere }),
    prisma.purchaseBill.aggregate({
      where: { ...monthWhere, status: "CONFIRMED" },
      _sum: { netWeight: true },
    }),
    prisma.purchaseBill.count({
      where: {
        status: "PENDING",
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.poId ? { poId: query.poId } : {}),
      },
    }),
  ]);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalBillsThisMonth,
      totalFabricPurchasedKg: Number(fabricAgg._sum.netWeight ?? 0),
      pendingApprovalCount,
    },
  };
}

export async function getById(id: string) {
  const bill = await prisma.purchaseBill.findUnique({
    where: { id },
    include: billInclude,
  });
  if (!bill) {
    throw new AppError("Purchase bill not found", 404, "NOT_FOUND");
  }

  const stockTxn = await prisma.stockTransaction.findFirst({
    where: {
      referenceId: bill.id,
      referenceType: { in: ["PURCHASE_BILL", "PurchaseBill"] },
      transactionType: "PURCHASE_IN",
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = paymentTotals(Number(bill.totalAmount), bill.payments);

  return {
    ...bill,
    stockUpdate: {
      stockUpdated: Boolean(stockTxn || bill.status === "CONFIRMED"),
      stockUpdatedAt: bill.confirmedAt ?? stockTxn?.createdAt ?? null,
      quantityAdded: stockTxn ? Number(stockTxn.quantity) : bill.status === "CONFIRMED" ? Number(bill.netWeight) : 0,
    },
    paymentHistory: bill.payments,
    totalPaid: totals.totalPaid,
    outstanding: totals.outstanding,
  };
}

export async function create(input: PurchaseCreateInput) {
  const supplier = await prisma.party.findUnique({ where: { id: input.supplierId } });
  if (!supplier || supplier.type !== "SUPPLIER") {
    throw new AppError("Supplier party not found", 400, "INVALID_SUPPLIER");
  }

  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId } });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }
  if (po.status === "CANCELLED") {
    throw new AppError("Cannot attach a bill to a cancelled PO", 400, "INVALID_PO");
  }

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  if (product.category !== "RAW_MATERIAL") {
    throw new AppError("Product must be RAW_MATERIAL", 400, "INVALID_PRODUCT");
  }

  if (input.grossWeight <= input.tareWeight) {
    throw new AppError("grossWeight must be greater than tareWeight", 400, "INVALID_WEIGHT");
  }

  const netWeight = round3(input.grossWeight - input.tareWeight);
  const gstPercent =
    input.gstPercent != null ? input.gstPercent : await resolveGstPercent();
  const taxable = round2(netWeight * input.ratePerKg);
  const gstAmount = round2(taxable * (gstPercent / 100));
  const totalAmount = round2(taxable + gstAmount);
  const billNumber = await generatePBNumber(prisma);

  return prisma.purchaseBill.create({
    data: {
      billNumber,
      supplierId: input.supplierId,
      supplierInvoiceNo: input.supplierInvoiceNo,
      purchaseDate: input.purchaseDate,
      poId: input.poId,
      productId: input.productId,
      vehicleNumber: input.vehicleNumber,
      grossWeight: input.grossWeight,
      tareWeight: input.tareWeight,
      netWeight,
      ratePerKg: input.ratePerKg,
      gstPercent,
      gstAmount,
      totalAmount,
      status: "PENDING",
    },
    include: billInclude,
  });
}

export async function confirm(id: string, userId: string) {
  const bill = await prisma.purchaseBill.findUnique({ where: { id } });
  if (!bill) {
    throw new AppError("Purchase bill not found", 404, "NOT_FOUND");
  }
  if (bill.status !== "PENDING") {
    throw new AppError("Bill is already confirmed or returned", 400, "INVALID_STATUS");
  }

  const qty = Number(bill.netWeight);

  const confirmed = await prisma.$transaction(async (tx) => {
    if (bill.supplierInvoiceNo) {
      const duplicate = await tx.purchaseBill.findFirst({
        where: {
          id: { not: bill.id },
          supplierId: bill.supplierId,
          supplierInvoiceNo: bill.supplierInvoiceNo,
          status: "CONFIRMED",
        },
      });
      if (duplicate) {
        throw new AppError(
          "Duplicate supplier invoice number for this supplier",
          400,
          "DUPLICATE_INVOICE"
        );
      }
    }

    const updated = await tx.purchaseBill.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: billInclude,
    });

    const stock = await tx.stock.findUnique({ where: { productId: bill.productId } });
    if (!stock) {
      await tx.stock.create({ data: { productId: bill.productId, quantity: qty } });
    } else {
      await tx.stock.update({
        where: { productId: bill.productId },
        data: { quantity: { increment: qty } },
      });
    }

    await tx.stockTransaction.create({
      data: {
        productId: bill.productId,
        transactionType: "PURCHASE_IN",
        quantity: qty,
        referenceType: "PURCHASE_BILL",
        referenceId: bill.id,
        notes: `Confirmed ${bill.billNumber}`,
        createdById: userId,
      },
    });

    await createLedgerEntry(
      {
        partyId: bill.supplierId,
        description: `Purchase Bill ${bill.billNumber}`,
        referenceType: "PURCHASE_BILL",
        referenceId: bill.id,
        debitAmount: 0,
        creditAmount: Number(bill.totalAmount),
      },
      tx
    );

    return updated;
  });

  void notifyActiveUsers({
    type: NotificationType.PURCHASE_RECEIVED,
    title: "Purchase received",
    message: `Purchase bill ${confirmed.billNumber} was confirmed and stock updated.`,
    metadata: { entityType: "PURCHASE_BILL", entityId: confirmed.id },
    dedupeKey: `PURCHASE_RECEIVED:${confirmed.id}`,
  });

  return {
    ...confirmed,
    stockUpdate: {
      stockUpdated: true,
      stockUpdatedAt: confirmed.confirmedAt,
      quantityAdded: qty,
    },
  };
}

export async function markReturned(id: string, input: PurchaseReturnInput, userId: string) {
  const bill = await prisma.purchaseBill.findUnique({ where: { id } });
  if (!bill) {
    throw new AppError("Purchase bill not found", 404, "NOT_FOUND");
  }
  if (bill.status === "RETURNED") {
    throw new AppError("Bill is already returned", 400, "INVALID_STATUS");
  }

  const qty = Number(bill.netWeight);

  if (bill.status === "CONFIRMED") {
    await validateStock(bill.productId, qty, prisma);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchaseBill.update({
      where: { id },
      data: { status: "RETURNED" },
      include: billInclude,
    });

    if (bill.status === "CONFIRMED") {
      const stock = await tx.stock.findUnique({ where: { productId: bill.productId } });
      if (!stock || Number(stock.quantity) < qty) {
        throw new AppError("Insufficient stock to reverse this purchase", 400, "INSUFFICIENT_STOCK");
      }

      await tx.stock.update({
        where: { productId: bill.productId },
        data: { quantity: { decrement: qty } },
      });

      await tx.stockTransaction.create({
        data: {
          productId: bill.productId,
          transactionType: "ADJUSTMENT",
          quantity: -qty,
          referenceType: "PURCHASE_RETURN",
          referenceId: bill.id,
          notes: input.reason,
          createdById: userId,
        },
      });

      await createLedgerEntry(
        {
          partyId: bill.supplierId,
          description: `Purchase Return ${bill.billNumber}`,
          referenceType: "PURCHASE_RETURN",
          referenceId: bill.id,
          debitAmount: Number(bill.totalAmount),
          creditAmount: 0,
        },
        tx
      );
    }

    return updated;
  });
}

export async function register(query: PurchaseRegisterQuery) {
  const where: Prisma.PurchaseBillWhereInput = {
    purchaseDate: { gte: query.from, lte: query.to },
  };
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.fabricType) where.productId = query.fabricType;

  const bills = await prisma.purchaseBill.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, productCode: true } },
      payments: true,
    },
    orderBy: { purchaseDate: "asc" },
  });

  const rows = bills.map((bill) => {
    const taxable = round2(Number(bill.netWeight) * Number(bill.ratePerKg));
    const totals = paymentTotals(Number(bill.totalAmount), bill.payments);
    return {
      billNumber: bill.billNumber,
      date: bill.purchaseDate,
      supplier: bill.supplier,
      fabricType: bill.product,
      qty: Number(bill.netWeight),
      rate: Number(bill.ratePerKg),
      total: taxable,
      gst: Number(bill.gstAmount),
      netTotal: Number(bill.totalAmount),
      paymentStatus: totals.paymentStatus,
      outstanding: totals.outstanding,
      status: bill.status,
    };
  });

  const confirmed = bills.filter((bill) => bill.status === "CONFIRMED");
  const totalPurchases = round2(confirmed.reduce((sum, bill) => sum + Number(bill.totalAmount), 0));
  const totalFabricReceived = round3(confirmed.reduce((sum, bill) => sum + Number(bill.netWeight), 0));
  const pendingPayments = round2(
    confirmed.reduce((sum, bill) => sum + paymentTotals(Number(bill.totalAmount), bill.payments).outstanding, 0)
  );

  return {
    filters: {
      from: query.from,
      to: query.to,
      supplierId: query.supplierId ?? null,
      fabricType: query.fabricType ?? null,
    },
    summary: {
      totalPurchases,
      totalFabricReceived,
      pendingPayments,
    },
    bills: rows,
    totals: {
      totalQty: round3(rows.reduce((sum, row) => sum + row.qty, 0)),
      totalAmount: round2(rows.reduce((sum, row) => sum + row.total, 0)),
      totalGST: round2(rows.reduce((sum, row) => sum + row.gst, 0)),
      totalNetTotal: round2(rows.reduce((sum, row) => sum + row.netTotal, 0)),
    },
  };
}

export async function registerCsv(query: PurchaseRegisterQuery): Promise<{ filename: string; csv: string }> {
  const data = await register(query);
  const csv = toCsv(
    ["Bill Number", "Date", "Supplier", "Fabric", "Qty", "Rate", "Taxable", "GST", "Net Total", "Outstanding", "Status"],
    data.bills.map((bill) => [
      bill.billNumber,
      new Date(bill.date).toISOString().slice(0, 10),
      bill.supplier.name,
      bill.fabricType.name,
      bill.qty,
      bill.rate,
      bill.total,
      bill.gst,
      bill.netTotal,
      bill.outstanding,
      bill.status,
    ])
  );
  return { filename: "purchase-register.csv", csv };
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  await getById(id);
  await prisma.$transaction(async (tx) => {
    await reverseStockByReference(tx, ["PURCHASE_BILL", "PurchaseBill", "PURCHASE_RETURN"], id);
    await deleteLedgerByReference(tx, ["PURCHASE_BILL", "PURCHASE_RETURN"], id);
    await tx.supplierPayment.deleteMany({ where: { purchaseBillId: id } });
    await tx.purchaseBill.delete({ where: { id } });
  });
  return { id, message: "Deleted permanently" };
}
