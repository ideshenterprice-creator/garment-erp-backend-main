import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { StockAdjustInput, StockHistoryQuery, StockListQuery } from "./stock.schema";

export type StockStatus = "OUT_OF_STOCK" | "LOW" | "AVAILABLE";

function stockStatus(quantity: number): StockStatus {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= 100) return "LOW";
  return "AVAILABLE";
}

function withStatus<T extends { quantity: Prisma.Decimal }>(row: T) {
  const quantity = Number(row.quantity);
  return { ...row, quantity, stockStatus: stockStatus(quantity) };
}

export async function list(query: StockListQuery) {
  const where: Prisma.StockWhereInput = {
    product: {
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { name: { contains: query.search, mode: "insensitive" } } : {}),
    },
  };
  if (query.lowStock) {
    where.quantity = { lte: 100 };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.stock.findMany({
      where,
      include: {
        product: {
          select: { id: true, productCode: true, name: true, category: true, unit: true },
        },
      },
      orderBy: { lastUpdated: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.stock.count({ where }),
  ]);

  return {
    data: rows.map(withStatus),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getByProduct(productId: string) {
  const stock = await prisma.stock.findUnique({
    where: { productId },
    include: {
      product: true,
    },
  });
  if (!stock) {
    throw new AppError("Stock not found for product", 404, "NOT_FOUND");
  }

  const transactions = await prisma.stockTransaction.findMany({
    where: { productId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    ...withStatus(stock),
    transactions,
  };
}

export async function history(productId: string, query: StockHistoryQuery) {
  const stock = await prisma.stock.findUnique({ where: { productId } });
  if (!stock) {
    throw new AppError("Stock not found for product", 404, "NOT_FOUND");
  }

  const where: Prisma.StockTransactionWhereInput = { productId };
  if (query.transactionType) where.transactionType = query.transactionType;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total] = await prisma.$transaction([
    prisma.stockTransaction.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.stockTransaction.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function adjust(productId: string, input: StockAdjustInput, userId: string) {
  const stock = await prisma.stock.findUnique({
    where: { productId },
    include: { product: true },
  });
  if (!stock) {
    throw new AppError("Stock not found for product", 404, "NOT_FOUND");
  }

  const available = Number(stock.quantity);
  if (input.adjustmentType === "REDUCE" && available < input.quantity) {
    throw new AppError(
      `Cannot reduce by more than available stock. Available: ${available}`,
      400,
      "INSUFFICIENT_STOCK"
    );
  }

  const delta = input.adjustmentType === "ADD" ? input.quantity : -input.quantity;
  const note = input.notes ? `${input.reason}: ${input.notes}` : input.reason;

  const adjusted = await prisma.$transaction(async (tx) => {
    const updated = await tx.stock.update({
      where: { productId },
      data: { quantity: { increment: delta } },
      include: { product: true },
    });

    if (Number(updated.quantity) < 0) {
      throw new AppError("Stock cannot go below zero", 400, "INSUFFICIENT_STOCK");
    }

    await tx.stockTransaction.create({
      data: {
        productId,
        transactionType: "ADJUSTMENT",
        quantity: delta,
        referenceType: "MANUAL_ADJUSTMENT",
        referenceId: updated.id,
        notes: note,
        createdById: userId,
        createdAt: input.date ?? new Date(),
      },
    });

    return withStatus(updated);
  });

  const { maybeNotifyLowStock } = await import("@/modules/notifications/notification.service");
  void maybeNotifyLowStock(productId);

  return adjusted;
}
