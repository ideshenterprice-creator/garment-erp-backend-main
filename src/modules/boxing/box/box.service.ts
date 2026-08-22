import { Prisma, SizeLabel } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateBoxNumber } from "@/utils/generateId";
import { validateStock } from "@/utils/stockValidator";
import {
  SIZE_QTY_FIELDS,
  findFinishedGoodForDesignSize,
  stockAvailable,
  throwStockErrors,
} from "../finishedGoods";
import { BoxCreateInput, BoxListQuery } from "./box.schema";

const include = {
  po: {
    select: {
      id: true,
      poNumber: true,
      status: true,
      buyer: { select: { id: true, name: true, city: true, country: true } },
    },
  },
  poItem: true,
  container: { select: { id: true, containerNumber: true, status: true } },
} as const;

export async function list(query: BoxListQuery) {
  const where: Prisma.BoxPackingWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.status) where.status = query.status;
  if (query.containerId) where.containerId = query.containerId;

  const [data, total] = await prisma.$transaction([
    prisma.boxPacking.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.boxPacking.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const box = await prisma.boxPacking.findUnique({ where: { id }, include });
  if (!box) throw new AppError("Box not found", 404, "NOT_FOUND");
  return box;
}

export async function create(input: BoxCreateInput, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId } });
  if (!po) throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  if (po.status === "CANCELLED") {
    throw new AppError("Cannot pack boxes for a cancelled PO", 400, "INVALID_PO");
  }

  const poItem = await prisma.pOItem.findUnique({ where: { id: input.poItemId } });
  if (!poItem || poItem.poId !== input.poId) {
    throw new AppError("PO item does not belong to this purchase order", 400, "INVALID_PO_ITEM");
  }

  const totalPieces =
    input.qty_0_3M +
    input.qty_3_6M +
    input.qty_6_9M +
    input.qty_9_12M +
    input.qty_12_18M +
    input.qty_18_24M;
  if (totalPieces <= 0) {
    throw new AppError("totalPieces must be greater than 0", 400, "INVALID_QUANTITY");
  }

  const lines: Array<{ productId: string; qty: number; sizeLabel: SizeLabel; label: string }> = [];
  const errors: string[] = [];

  for (const [field, sizeLabel, label] of SIZE_QTY_FIELDS) {
    const qty = input[field];
    if (qty <= 0) continue;
    const product = await findFinishedGoodForDesignSize(input.designNumber, sizeLabel);
    if (!product) {
      errors.push(`Finished good product not found for ${label}`);
      continue;
    }
    const available = await stockAvailable(product.id);
    if (available < qty) {
      errors.push(`Insufficient finished stock for ${label}. Available: ${available}, Required: ${qty}`);
      continue;
    }
    try {
      await validateStock(product.id, qty, prisma);
    } catch {
      errors.push(`Insufficient finished stock for ${label}. Available: ${available}, Required: ${qty}`);
      continue;
    }
    lines.push({ productId: product.id, qty, sizeLabel, label });
  }

  throwStockErrors(errors);

  const boxNumber = await generateBoxNumber(prisma);

  return prisma.$transaction(async (tx) => {
    const box = await tx.boxPacking.create({
      data: {
        boxNumber,
        poId: input.poId,
        poItemId: input.poItemId,
        designNumber: input.designNumber,
        color: input.color,
        qty_0_3M: input.qty_0_3M,
        qty_3_6M: input.qty_3_6M,
        qty_6_9M: input.qty_6_9M,
        qty_9_12M: input.qty_9_12M,
        qty_12_18M: input.qty_12_18M,
        qty_18_24M: input.qty_18_24M,
        totalPieces,
        status: "PACKED",
      },
      include,
    });

    for (const line of lines) {
      const stock = await tx.stock.update({
        where: { productId: line.productId },
        data: { quantity: { decrement: line.qty } },
      });
      if (Number(stock.quantity) < 0) {
        throw new AppError(
          `Insufficient finished stock for ${line.label}. Available cannot go below 0`,
          400,
          "INSUFFICIENT_STOCK"
        );
      }
      await tx.stockTransaction.create({
        data: {
          productId: line.productId,
          transactionType: "SALE_OUT",
          quantity: -line.qty,
          referenceType: "BOX_PACKING",
          referenceId: box.id,
          notes: `${boxNumber} ${line.label}`,
          createdById: userId,
        },
      });
    }

    return box;
  });
}
