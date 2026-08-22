import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { WastageCreateInput, WastageListQuery } from "./wastage.schema";

const wastageInclude = {
  po: { select: { id: true, poNumber: true, status: true } },
  fabricType: { select: { id: true, productCode: true, name: true, category: true, unit: true } },
  returnedBy: { select: { id: true, partyNumber: true, name: true, type: true } },
} as const;

async function nextWastageNumber(): Promise<string> {
  const count = await prisma.cuttingWastage.count({
    where: { wastageNumber: { startsWith: "CW-" } },
  });
  return `CW-${String(count + 1).padStart(3, "0")}`;
}

async function resolveWastageProduct() {
  const named = await prisma.product.findFirst({
    where: {
      category: "WASTAGE",
      isActive: true,
      name: { contains: "Cutting Wastage", mode: "insensitive" },
    },
  });
  if (named) return named;

  const anyWastage = await prisma.product.findFirst({
    where: { category: "WASTAGE", isActive: true },
  });
  if (!anyWastage) {
    throw new AppError(
      "Create a WASTAGE category product named 'Cutting Wastage' in product masters first",
      400,
      "WASTAGE_PRODUCT_MISSING"
    );
  }
  return anyWastage;
}

export async function list(query: WastageListQuery) {
  const where: Prisma.CuttingWastageWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.poId) where.poId = query.poId;
  if (query.from || query.to) {
    where.dateOfReturn = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total, inStock, sold] = await prisma.$transaction([
    prisma.cuttingWastage.findMany({
      where,
      include: wastageInclude,
      orderBy: { dateOfReturn: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.cuttingWastage.count({ where }),
    prisma.cuttingWastage.aggregate({
      where: { ...where, status: "IN_STOCK" },
      _sum: { wastageQty: true },
    }),
    prisma.cuttingWastage.aggregate({
      where: { ...where, status: "SOLD" },
      _sum: { wastageQty: true },
    }),
  ]);

  const totalWastageInStock = Number(inStock._sum.wastageQty ?? 0);
  const totalWastageSold = Number(sold._sum.wastageQty ?? 0);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalWastageInStock,
      totalWastageSold,
      totalWastageValue: 0,
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.cuttingWastage.findUnique({
    where: { id },
    include: wastageInclude,
  });
  if (!row) {
    throw new AppError("Wastage record not found", 404, "NOT_FOUND");
  }
  return row;
}

export async function create(input: WastageCreateInput, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId } });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }

  const fabric = await prisma.product.findUnique({ where: { id: input.fabricProductId } });
  if (!fabric) {
    throw new AppError("Fabric product not found", 404, "NOT_FOUND");
  }
  if (fabric.category !== "RAW_MATERIAL") {
    throw new AppError("fabricProductId must be a RAW_MATERIAL product", 400, "INVALID_PRODUCT");
  }

  const returnedBy = await prisma.party.findUnique({ where: { id: input.returnedByPartyId } });
  if (!returnedBy || returnedBy.type !== "KARIGAR") {
    throw new AppError("returnedByPartyId must be a KARIGAR party", 400, "INVALID_PARTY");
  }

  const wastageProduct = await resolveWastageProduct();
  const wastageNumber = await nextWastageNumber();

  return prisma.$transaction(async (tx) => {
    const row = await tx.cuttingWastage.create({
      data: {
        wastageNumber,
        poId: input.poId,
        designCode: input.designCode,
        fabricTypeId: input.fabricProductId,
        wastageQty: input.wastageQty,
        returnedById: input.returnedByPartyId,
        dateOfReturn: input.dateOfReturn,
        remarks: input.remarks,
        status: "IN_STOCK",
      },
      include: wastageInclude,
    });

    const stock = await tx.stock.findUnique({ where: { productId: wastageProduct.id } });
    if (!stock) {
      await tx.stock.create({
        data: { productId: wastageProduct.id, quantity: input.wastageQty },
      });
    } else {
      await tx.stock.update({
        where: { productId: wastageProduct.id },
        data: { quantity: { increment: input.wastageQty } },
      });
    }

    await tx.stockTransaction.create({
      data: {
        productId: wastageProduct.id,
        transactionType: "WASTAGE_IN",
        quantity: input.wastageQty,
        referenceType: "CUTTING_WASTAGE",
        referenceId: row.id,
        notes: wastageNumber,
        createdById: userId,
      },
    });

    return row;
  });
}

export async function markSold(id: string, userId: string) {
  const row = await prisma.cuttingWastage.findUnique({ where: { id } });
  if (!row) {
    throw new AppError("Wastage record not found", 404, "NOT_FOUND");
  }
  if (row.status === "SOLD") {
    throw new AppError("Wastage is already marked sold", 400, "INVALID_STATUS");
  }

  const wastageProduct = await resolveWastageProduct();
  const qty = Number(row.wastageQty);
  const stock = await prisma.stock.findUnique({ where: { productId: wastageProduct.id } });
  const available = stock ? Number(stock.quantity) : 0;
  if (available < qty) {
    throw new AppError(
      `Cannot reduce by more than available stock. Available: ${available}`,
      400,
      "INSUFFICIENT_STOCK"
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.cuttingWastage.update({
      where: { id },
      data: { status: "SOLD" },
      include: wastageInclude,
    });

    const after = await tx.stock.update({
      where: { productId: wastageProduct.id },
      data: { quantity: { decrement: qty } },
    });
    if (Number(after.quantity) < 0) {
      throw new AppError("Stock cannot go below zero", 400, "INSUFFICIENT_STOCK");
    }

    await tx.stockTransaction.create({
      data: {
        productId: wastageProduct.id,
        transactionType: "SALE_OUT",
        quantity: -qty,
        referenceType: "CUTTING_WASTAGE",
        referenceId: row.id,
        notes: `Sold ${row.wastageNumber}`,
        createdById: userId,
      },
    });

    return updated;
  });
}
