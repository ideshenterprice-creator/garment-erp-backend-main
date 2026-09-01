import { BundleStage, IssueType, Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateBundleNumber, generateIssueNumber } from "@/utils/generateId";
import { validateStock } from "@/utils/stockValidator";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { IssueCreateInput, IssueListQuery, IssueReturnInput } from "./issue.schema";

const issueInclude = {
  product: { select: { id: true, productCode: true, name: true, unit: true, category: true } },
  karigar: { select: { id: true, partyNumber: true, name: true, type: true, contact: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  poItem: true,
  bundles: {
    select: { id: true, bundleNumber: true, currentStage: true, status: true },
  },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

function toBundleStage(issueType: IssueType): BundleStage {
  if (issueType === "PRINTING") return "PRINTING";
  if (issueType === "STITCHING") return "STITCHING";
  if (issueType === "FINISHING") return "FINISHING";
  return "CUTTING";
}

export async function list(query: IssueListQuery) {
  const where: Prisma.IssueRecordWhereInput = {};
  if (query.issueType) where.issueType = query.issueType;
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.poId) where.poId = query.poId;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.issueDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total] = await prisma.$transaction([
    prisma.issueRecord.findMany({
      where,
      include: issueInclude,
      orderBy: { issueDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.issueRecord.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const issue = await prisma.issueRecord.findUnique({
    where: { id },
    include: issueInclude,
  });
  if (!issue) {
    throw new AppError("Issue record not found", 404, "NOT_FOUND");
  }
  return issue;
}

export async function create(input: IssueCreateInput, userId: string) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: input.poId } });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }
  if (po.status === "CANCELLED") {
    throw new AppError("Cannot issue against a cancelled PO", 400, "INVALID_PO");
  }

  const poItem = await prisma.pOItem.findUnique({ where: { id: input.poItemId } });
  if (!poItem || poItem.poId !== input.poId) {
    throw new AppError("PO item does not belong to this purchase order", 400, "INVALID_PO_ITEM");
  }

  const karigar = await prisma.party.findUnique({ where: { id: input.karigarId } });
  if (!karigar || karigar.type !== "KARIGAR") {
    throw new AppError("Karigar party not found", 400, "INVALID_KARIGAR");
  }

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  try {
    await validateStock(input.productId, input.quantityIssued, prisma);
  } catch (error) {
    if (error instanceof AppError && error.code === "INSUFFICIENT_STOCK") {
      const available =
        typeof error.details === "object" &&
        error.details !== null &&
        "available" in error.details &&
        typeof error.details.available === "number"
          ? error.details.available
          : 0;
      throw new AppError(
        `Insufficient stock. Available: ${available}. You entered: ${input.quantityIssued}. Please reduce quantity.`,
        400,
        "INSUFFICIENT_STOCK"
      );
    }
    throw error;
  }

  const issueNumber = await generateIssueNumber(prisma);
  const bundleNumber = await generateBundleNumber(prisma);

  const created = await prisma.$transaction(async (tx) => {
    const issue = await tx.issueRecord.create({
      data: {
        issueNumber,
        issueDate: input.issueDate,
        issueType: input.issueType,
        productId: input.productId,
        poId: input.poId,
        poItemId: input.poItemId,
        karigarId: input.karigarId,
        quantityIssued: input.quantityIssued,
        bundleNumber,
        notes: input.notes,
        createdById: userId,
        status: "ISSUED",
      },
    });

    const bundle = await tx.bundle.create({
      data: {
        bundleNumber,
        poId: input.poId,
        poItemId: input.poItemId,
        issueId: issue.id,
        currentStage: toBundleStage(input.issueType),
        status: "IN_PROGRESS",
      },
    });

    const stock = await tx.stock.update({
      where: { productId: input.productId },
      data: { quantity: { decrement: input.quantityIssued } },
    });
    if (Number(stock.quantity) < 0) {
      throw new AppError("Stock cannot go below zero", 400, "INSUFFICIENT_STOCK");
    }

    await tx.stockTransaction.create({
      data: {
        productId: input.productId,
        transactionType: "ISSUE_OUT",
        quantity: -input.quantityIssued,
        referenceType: "ISSUE",
        referenceId: issue.id,
        notes: issueNumber,
        createdById: userId,
      },
    });

    await updatePOStatus(input.poId, tx);

    const full = await tx.issueRecord.findUniqueOrThrow({
      where: { id: issue.id },
      include: issueInclude,
    });

    return { ...full, bundleNumber: bundle.bundleNumber, bundle };
  });

  const { maybeNotifyLowStock } = await import("@/modules/notifications/notification.service");
  void maybeNotifyLowStock(input.productId);

  return created;
}

export async function markReturned(id: string, input: IssueReturnInput, userId: string) {
  const issue = await prisma.issueRecord.findUnique({ where: { id } });
  if (!issue) {
    throw new AppError("Issue record not found", 404, "NOT_FOUND");
  }
  if (issue.status === "RETURNED") {
    throw new AppError("Issue is already returned", 400, "INVALID_STATUS");
  }

  const issuedQty = Number(issue.quantityIssued);
  if (input.quantityReturned > issuedQty) {
    throw new AppError("quantityReturned cannot exceed quantityIssued", 400, "INVALID_QUANTITY");
  }

  const status = input.quantityReturned === issuedQty ? "RETURNED" : "PARTIAL";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.issueRecord.update({
      where: { id },
      data: {
        status,
        notes: input.notes ?? issue.notes,
      },
      include: issueInclude,
    });

    await tx.stock.update({
      where: { productId: issue.productId },
      data: { quantity: { increment: input.quantityReturned } },
    });

    await tx.stockTransaction.create({
      data: {
        productId: issue.productId,
        transactionType: "PRODUCTION_IN",
        quantity: input.quantityReturned,
        referenceType: "ISSUE_RETURN",
        referenceId: issue.id,
        notes: input.notes,
        createdById: userId,
      },
    });

    return updated;
  });
}
