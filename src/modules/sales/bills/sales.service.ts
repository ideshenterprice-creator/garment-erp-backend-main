import { Prisma, SalesBillStatus, TaxType } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateInvoiceNumber, generateVoucherNumber } from "@/utils/generateId";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import { validateStock } from "@/utils/stockValidator";
import { toCsv } from "@/utils/csv";
import { reverseStockByReference, deleteLedgerByReference } from "@/utils/stockReverse";
import {
  findFinishedGoodForDesignSize,
  parseSizeLabel,
  stockAvailable,
  throwStockErrors,
} from "@/modules/boxing/finishedGoods";
import {
  notifyActiveUsers,
  NotificationType,
} from "@/modules/notifications/notification.service";
import { buildSalesBillPdf } from "./salesPdf.service";
import {
  SalesCreateInput,
  SalesListQuery,
  SalesPaymentInput,
  SalesRegisterQuery,
  SalesReturnInput,
} from "./sales.schema";

const include = {
  buyer: true,
  po: { select: { id: true, poNumber: true, status: true, buyerPoReference: true } },
  container: { select: { id: true, containerNumber: true, status: true, destination: true } },
  items: true,
} as const;

function billTag(billId: string): string {
  return `SALES_BILL:${billId}`;
}

async function sumReceipts(billId: string, db: typeof prisma | Prisma.TransactionClient = prisma): Promise<number> {
  const vouchers = await db.voucher.findMany({
    where: { type: "RECEIPT", notes: { startsWith: billTag(billId) } },
  });
  return Number(vouchers.reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2));
}

async function collectItemStockErrors(
  items: Array<{ designNumber: string; size: string; quantity: number }>
): Promise<string[]> {
  const errors: string[] = [];
  for (const item of items) {
    const sizeLabel = parseSizeLabel(item.size);
    if (!sizeLabel) {
      errors.push(`Invalid size ${item.size}`);
      continue;
    }
    const product = await findFinishedGoodForDesignSize(item.designNumber, sizeLabel);
    if (!product) {
      errors.push(`Finished good product not found for ${item.size}`);
      continue;
    }
    const available = await stockAvailable(product.id);
    if (available < item.quantity) {
      errors.push(
        `Insufficient finished stock for ${item.size}. Available: ${available}, Required: ${item.quantity}`
      );
      continue;
    }
    try {
      await validateStock(product.id, item.quantity, prisma);
    } catch {
      errors.push(
        `Insufficient finished stock for ${item.size}. Available: ${available}, Required: ${item.quantity}`
      );
    }
  }
  return errors;
}

function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

async function computeSalesTax(
  subTotal: number,
  currency: string
): Promise<{ gstAmount: number; taxType: TaxType }> {
  if (currency.toUpperCase() !== "INR") {
    return { gstAmount: 0, taxType: "ZERO_RATED" };
  }

  const rate = await prisma.gSTRate.findFirst({
    where: {
      OR: [
        { applicableOn: { contains: "sales", mode: "insensitive" } },
        { applicableOn: { contains: "export", mode: "insensitive" } },
        { applicableOn: { contains: "finished", mode: "insensitive" } },
        { category: { contains: "garment", mode: "insensitive" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!rate || rate.taxType === "ZERO_RATED") {
    return { gstAmount: 0, taxType: rate?.taxType ?? "ZERO_RATED" };
  }

  const gstPercent = Number(rate.gstPercent);
  return {
    gstAmount: Number(((subTotal * gstPercent) / 100).toFixed(2)),
    taxType: rate.taxType,
  };
}

export async function list(query: SalesListQuery) {
  const where: Prisma.SalesBillWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.buyerId) where.buyerId = query.buyerId;
  if (query.poId) where.poId = query.poId;
  if (query.from || query.to) {
    where.invoiceDate = {};
    if (query.from) where.invoiceDate.gte = query.from;
    if (query.to) where.invoiceDate.lte = query.to;
  }

  const { start, end } = monthBounds();
  const [data, total, billedThisMonth, pendingRows, billsRaised] = await prisma.$transaction([
    prisma.salesBill.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true } },
        po: { select: { id: true, poNumber: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.salesBill.count({ where }),
    prisma.salesBill.aggregate({
      where: {
        status: { in: ["SUBMITTED", "PAID"] },
        invoiceDate: { gte: start, lt: end },
      },
      _sum: { netTotal: true },
    }),
    prisma.salesBill.findMany({
      where: { status: "SUBMITTED" },
      select: { id: true, netTotal: true },
    }),
    prisma.salesBill.count({ where: { status: { in: ["SUBMITTED", "PAID"] } } }),
  ]);

  let pendingPayment = 0;
  for (const row of pendingRows) {
    const paid = await sumReceipts(row.id);
    pendingPayment += Math.max(0, Number(row.netTotal) - paid);
  }

  const rows = data.map((bill) => ({
    ...bill,
    totalPieces: bill.items.reduce((sum, item) => sum + item.quantity, 0),
  }));

  return {
    data: rows,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalBilledThisMonth: Number(billedThisMonth._sum.netTotal ?? 0),
      pendingPayment: Number(pendingPayment.toFixed(2)),
      billsRaised,
    },
  };
}

export async function getById(id: string) {
  const bill = await prisma.salesBill.findUnique({ where: { id }, include });
  if (!bill) throw new AppError("Sales bill not found", 404, "NOT_FOUND");
  const amountPaid = await sumReceipts(id);
  const outstanding = Number((Number(bill.netTotal) - amountPaid).toFixed(2));
  const vouchers = await prisma.voucher.findMany({
    where: { type: "RECEIPT", notes: { startsWith: billTag(id) } },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: { date: "asc" },
  });
  const paymentHistory = vouchers.map((voucher) => ({
    id: voucher.id,
    salesBillId: id,
    date: voucher.date,
    paymentMode: voucher.paymentMode,
    amount: Number(voucher.amount),
    referenceNo: voucher.referenceNo,
    processedBy: voucher.createdBy?.name ?? voucher.createdBy?.email ?? "—",
    status: "SUCCESS" as const,
  }));
  return {
    ...bill,
    totalPieces: bill.items.reduce((sum, item) => sum + item.quantity, 0),
    paymentRecord: {
      totalPaid: amountPaid,
      outstanding,
    },
    payment: {
      amountPaid,
      outstanding,
    },
    paymentHistory,
  };
}

export async function create(input: SalesCreateInput) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId } });
  if (!po) throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  if (
    po.status !== "READY_TO_SHIP" &&
    po.status !== "IN_PRODUCTION" &&
    po.status !== "ACTIVE"
  ) {
    throw new AppError(
      "PO must be ACTIVE, READY_TO_SHIP or IN_PRODUCTION to raise a sales bill",
      400,
      "INVALID_PO"
    );
  }

  if (input.containerId) {
    const container = await prisma.container.findUnique({ where: { id: input.containerId } });
    if (!container) throw new AppError("Container not found", 404, "NOT_FOUND");
    if (container.poId !== input.poId) {
      throw new AppError("Container belongs to a different PO", 400, "INVALID_CONTAINER");
    }
  }

  throwStockErrors(await collectItemStockErrors(input.items));

  const items = input.items.map((item) => ({
    poItemId: item.poItemId,
    designNumber: item.designNumber,
    garmentType: item.garmentType,
    color: item.color,
    size: item.size,
    quantity: item.quantity,
    ratePerPiece: item.ratePerPiece,
    amount: Number((item.quantity * item.ratePerPiece).toFixed(2)),
  }));
  const subTotal = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const tax = await computeSalesTax(subTotal, input.currency);
  const gstAmount = tax.gstAmount;
  const netTotal = Number((subTotal + gstAmount).toFixed(2));
  const invoiceNumber = await generateInvoiceNumber(prisma);

  const created = await prisma.$transaction(async (tx) => {
    return tx.salesBill.create({
      data: {
        invoiceNumber,
        poId: input.poId,
        buyerId: po.buyerId,
        containerId: input.containerId,
        invoiceDate: input.invoiceDate,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        subTotal,
        gstAmount,
        netTotal,
        status: "DRAFT",
        items: { create: items },
      },
      include,
    });
  });

  void notifyActiveUsers({
    type: NotificationType.SALES_BILL_CREATED,
    title: "Sales bill created",
    message: `Invoice ${created.invoiceNumber} was created.`,
    metadata: { entityType: "SALES_BILL", entityId: created.id },
    dedupeKey: `SALES_BILL:${created.id}`,
  });

  return created;
}

export async function submit(id: string) {
  const bill = await prisma.salesBill.findUnique({ where: { id }, include: { items: true } });
  if (!bill) throw new AppError("Sales bill not found", 404, "NOT_FOUND");
  if (bill.status !== "DRAFT") {
    throw new AppError("Only draft invoices can be submitted", 400, "INVALID_STATUS");
  }

  throwStockErrors(
    await collectItemStockErrors(
      bill.items.map((item) => ({
        designNumber: item.designNumber,
        size: item.size,
        quantity: item.quantity,
      }))
    )
  );

  return prisma.$transaction(async (tx) => {
    const updated = await tx.salesBill.update({
      where: { id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include,
    });

    await createLedgerEntry(
      {
        partyId: bill.buyerId,
        description: `Sales invoice ${bill.invoiceNumber}`,
        referenceType: "SALES_BILL",
        referenceId: bill.id,
        debitAmount: Number(bill.netTotal),
        creditAmount: 0,
      },
      tx
    );

    return updated;
  });
}

export async function recordPayment(id: string, input: SalesPaymentInput, userId: string) {
  const bill = await prisma.salesBill.findUnique({ where: { id } });
  if (!bill) throw new AppError("Sales bill not found", 404, "NOT_FOUND");
  if (bill.status === "DRAFT") {
    throw new AppError("Submit the bill before recording payment", 400, "INVALID_STATUS");
  }
  if (bill.status === "RETURNED") {
    throw new AppError("Cannot record payment on a returned bill", 400, "INVALID_STATUS");
  }

  return prisma.$transaction(async (tx) => {
    const alreadyPaid = await sumReceipts(id, tx);
    const outstanding = Number((Number(bill.netTotal) - alreadyPaid).toFixed(2));
    if (input.amountReceived > outstanding) {
      throw new AppError(
        `Payment exceeds outstanding amount. Outstanding: ${outstanding}`,
        400,
        "INVALID_AMOUNT"
      );
    }

    const voucherNumber = await generateVoucherNumber(prisma);
    await tx.voucher.create({
      data: {
        voucherNumber,
        type: "RECEIPT",
        partyDescription: `Buyer receipt ${bill.invoiceNumber}`,
        amount: input.amountReceived,
        paymentMode: input.paymentMode,
        referenceNo: input.referenceNo,
        date: input.paymentDate,
        notes: `${billTag(id)} ${bill.invoiceNumber}`,
        createdById: userId,
      },
    });

    await createLedgerEntry(
      {
        partyId: bill.buyerId,
        description: `Receipt against ${bill.invoiceNumber}`,
        referenceType: "SALES_PAYMENT",
        referenceId: bill.id,
        debitAmount: 0,
        creditAmount: input.amountReceived,
      },
      tx
    );

    const totalPaid = alreadyPaid + input.amountReceived;
    const nextStatus: SalesBillStatus =
      totalPaid >= Number(bill.netTotal) ? "PAID" : bill.status === "PAID" ? "PAID" : "SUBMITTED";

    const updated = await tx.salesBill.update({
      where: { id },
      data: { status: nextStatus },
      include,
    });

    void notifyActiveUsers({
      type: NotificationType.PAYMENT_RECORDED,
      title: "Payment recorded",
      message: `Receipt of ${input.amountReceived} recorded against ${bill.invoiceNumber}.`,
      metadata: { entityType: "SALES_BILL", entityId: bill.id },
      dedupeKey: `SALES_PAYMENT:${bill.id}:${input.referenceNo ?? input.paymentDate.toISOString()}`,
    });

    return {
      ...updated,
      payment: {
        amountPaid: Number(totalPaid.toFixed(2)),
        outstanding: Number((Number(bill.netTotal) - totalPaid).toFixed(2)),
      },
    };
  });
}

export async function markReturned(id: string, input: SalesReturnInput) {
  const bill = await prisma.salesBill.findUnique({ where: { id } });
  if (!bill) throw new AppError("Sales bill not found", 404, "NOT_FOUND");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.salesBill.update({
      where: { id },
      data: { status: "RETURNED" },
      include,
    });

    if (bill.status === "SUBMITTED" || bill.status === "PAID") {
      await createLedgerEntry(
        {
          partyId: bill.buyerId,
          description: `Sales return ${bill.invoiceNumber} — ${input.reason}`,
          referenceType: "SALES_BILL_RETURN",
          referenceId: bill.id,
          debitAmount: 0,
          creditAmount: Number(bill.netTotal),
        },
        tx
      );
    }

    return updated;
  });
}

export async function register(query: SalesRegisterQuery) {
  const where: Prisma.SalesBillWhereInput = {
    invoiceDate: { gte: query.from, lte: query.to },
    status: { not: "DRAFT" },
  };
  if (query.buyerId) where.buyerId = query.buyerId;
  if (query.poId) where.poId = query.poId;

  const bills = await prisma.salesBill.findMany({
    where,
    include: {
      buyer: { select: { id: true, name: true } },
      po: { select: { id: true, poNumber: true } },
      items: true,
    },
    orderBy: { invoiceDate: "asc" },
  });

  let totalSales = 0;
  let totalPieces = 0;
  let outstanding = 0;

  const rows = [];
  for (const bill of bills) {
    const pieces = bill.items.reduce((sum, item) => sum + item.quantity, 0);
    const paid = await sumReceipts(bill.id);
    const due = Math.max(0, Number(bill.netTotal) - paid);
    totalSales += Number(bill.netTotal);
    totalPieces += pieces;
    outstanding += due;
    rows.push({
      ...bill,
      totalPieces: pieces,
      amountPaid: paid,
      outstanding: Number(due.toFixed(2)),
    });
  }

  return {
    summary: {
      totalSales: Number(totalSales.toFixed(2)),
      totalPieces,
      outstanding: Number(outstanding.toFixed(2)),
    },
    bills: rows,
    totals: {
      totalAmount: Number(totalSales.toFixed(2)),
      totalPieces,
    },
  };
}

export async function registerCsv(query: SalesRegisterQuery): Promise<{ filename: string; csv: string }> {
  const data = await register(query);
  const csv = toCsv(
    [
      "Invoice Number",
      "Date",
      "Buyer",
      "PO",
      "Pieces",
      "Subtotal",
      "GST",
      "Net Total",
      "Amount Paid",
      "Outstanding",
      "Status",
    ],
    data.bills.map((bill) => [
      bill.invoiceNumber,
      new Date(bill.invoiceDate).toISOString().slice(0, 10),
      bill.buyer?.name ?? "",
      bill.po?.poNumber ?? "",
      bill.totalPieces,
      bill.subTotal,
      bill.gstAmount,
      bill.netTotal,
      bill.amountPaid,
      bill.outstanding,
      bill.status,
    ])
  );
  return { filename: `sales-register.csv`, csv };
}

export async function invoicePdf(id: string, userId?: string): Promise<{ filename: string; buffer: Buffer }> {
  const bill = await getById(id);
  const buffer = await buildSalesBillPdf({
    invoiceNumber: bill.invoiceNumber,
    invoiceDate: bill.invoiceDate,
    currency: bill.currency,
    buyer: {
      name: bill.buyer.name,
      contact: bill.buyer.contact,
      gstNumber: bill.buyer.gstNumber,
      city: bill.buyer.city,
      country: bill.buyer.country,
    },
    shippingDestination: bill.shippingDestination,
    paymentTerms: bill.paymentTerms,
    items: bill.items.map((item) => ({
      designNumber: item.designNumber,
      garmentType: item.garmentType,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      ratePerPiece: Number(item.ratePerPiece),
      amount: Number(item.amount),
    })),
    subTotal: Number(bill.subTotal),
    gstAmount: Number(bill.gstAmount),
    netTotal: Number(bill.netTotal),
    amountPaid: bill.payment.amountPaid,
    balance: bill.payment.outstanding,
    status: bill.status,
  });

  try {
    const storage = await import("@/services/storage/supabase-storage.service");
    if (storage.isStorageConfigured() && userId) {
      const existing = await prisma.fileAttachment.findFirst({
        where: { entityType: "SALES_BILL", entityId: bill.id },
        select: { id: true },
      });
      if (!existing) {
        const objectPath = `sales-bills/${bill.id}/${bill.invoiceNumber}.pdf`;
        await storage.uploadPrivateObject({
          objectPath,
          body: buffer,
          mimeType: "application/pdf",
        });
        await prisma.fileAttachment.create({
          data: {
            bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "erp-documents",
            objectPath,
            originalName: `${bill.invoiceNumber}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: buffer.length,
            entityType: "SALES_BILL",
            entityId: bill.id,
            uploadedById: userId,
          },
        });
      }
    }
  } catch {
    // PDF download still succeeds if storage is unavailable.
  }

  return { filename: `${bill.invoiceNumber}.pdf`, buffer };
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  await getById(id);
  await prisma.$transaction(async (tx) => {
    await reverseStockByReference(tx, ["SALES_BILL", "SALES_PAYMENT", "SALES_BILL_RETURN"], id);
    await deleteLedgerByReference(tx, ["SALES_BILL", "SALES_PAYMENT", "SALES_BILL_RETURN"], id);
    const notes = await tx.creditDebitNote.findMany({ where: { salesBillId: id }, select: { id: true } });
    for (const note of notes) {
      await deleteLedgerByReference(tx, "CREDIT_DEBIT_NOTE", note.id);
    }
    await tx.creditDebitNote.deleteMany({ where: { salesBillId: id } });
    await tx.salesBill.delete({ where: { id } });
  });
  return { id, message: "Deleted permanently" };
}
