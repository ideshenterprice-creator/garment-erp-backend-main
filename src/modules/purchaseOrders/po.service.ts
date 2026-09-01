import { IssueType, Prisma, PrismaClient } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generatePONumber } from "@/utils/generateId";
import { notifyActiveUsers, NotificationType } from "@/modules/notifications/notification.service";
import { POCancelInput, POCreateInput, POItemInput, POListQuery, POUpdateInput } from "./po.schema";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type StageProgressStatus = "DONE" | "IN_PROGRESS" | "PENDING";

export interface StageProgress {
  issued: number;
  completed: number;
  pending: number;
  status: StageProgressStatus;
}

export interface ProductionStages {
  cutting: StageProgress;
  printing: StageProgress;
  coloring: StageProgress;
  stitching: StageProgress;
  finishing: StageProgress;
}

const buyerSelect = {
  id: true,
  partyNumber: true,
  name: true,
  city: true,
  country: true,
  type: true,
} as const;

function itemTotal(item: POItemInput): number {
  return (
    item.qty_0_3M +
    item.qty_3_6M +
    item.qty_6_9M +
    item.qty_9_12M +
    item.qty_12_18M +
    item.qty_18_24M
  );
}

function toItemRows(items: POItemInput[]) {
  return items.map((item) => ({ ...item, totalPieces: itemTotal(item) }));
}

function stageStatus(issued: number, completed: number): StageProgressStatus {
  if (completed <= 0 && issued <= 0) {
    return "PENDING";
  }
  if (issued > 0 && completed >= issued) {
    return "DONE";
  }
  if (completed > 0) {
    return "IN_PROGRESS";
  }
  return "PENDING";
}

function toProgress(issued: number, completed: number): StageProgress {
  const safeIssued = Math.max(0, issued);
  const safeCompleted = Math.max(0, completed);
  const pending = Math.max(0, safeIssued - safeCompleted);
  return {
    issued: safeIssued,
    completed: safeCompleted,
    pending,
    status: stageStatus(safeIssued, safeCompleted),
  };
}

function searchWhere(search: string): Prisma.PurchaseOrderWhereInput {
  return {
    OR: [
      { poNumber: { contains: search, mode: "insensitive" } },
      { buyerPoReference: { contains: search, mode: "insensitive" } },
    ],
  };
}

async function sumIssued(db: DbClient, poId: string, issueType: IssueType): Promise<number> {
  const result = await db.issueRecord.aggregate({
    where: { poId, issueType },
    _sum: { quantityIssued: true },
  });
  return Number(result._sum.quantityIssued ?? 0);
}

async function buildProductionStages(db: DbClient, poId: string): Promise<ProductionStages> {
  const [cuttingIssued, printingIssued, stitchingIssued, finishingIssued, cutting, printing, coloring, stitching, finishing] =
    await Promise.all([
      sumIssued(db, poId, IssueType.CUTTING),
      sumIssued(db, poId, IssueType.PRINTING),
      sumIssued(db, poId, IssueType.STITCHING),
      sumIssued(db, poId, IssueType.FINISHING),
      db.cuttingEntry.aggregate({ where: { poId }, _sum: { totalPiecesCut: true } }),
      db.printingEntry.aggregate({ where: { poId }, _sum: { piecesReturned: true } }),
      db.coloringEntry.aggregate({ where: { poId }, _sum: { piecesReturned: true } }),
      db.stitchingEntry.aggregate({ where: { poId }, _sum: { piecesReturned: true } }),
      db.finishingEntry.aggregate({ where: { poId }, _sum: { piecesCompleted: true } }),
    ]);

  const cuttingCompleted = cutting._sum.totalPiecesCut ?? 0;
  const printingCompleted = printing._sum.piecesReturned ?? 0;
  const coloringCompleted = coloring._sum.piecesReturned ?? 0;
  const stitchingCompleted = stitching._sum.piecesReturned ?? 0;
  const finishingCompleted = finishing._sum.piecesCompleted ?? 0;

  return {
    cutting: toProgress(cuttingIssued, cuttingCompleted),
    printing: toProgress(printingIssued, printingCompleted),
    coloring: toProgress(printingCompleted, coloringCompleted),
    stitching: toProgress(stitchingIssued, stitchingCompleted),
    finishing: toProgress(finishingIssued, finishingCompleted),
  };
}

export async function updatePOStatus(poId: string, db: DbClient): Promise<void> {
  const po = await db.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, status: true },
  });
  if (!po || po.status === "CANCELLED") {
    return;
  }

  const [issueCount, bundles, paidSales] = await Promise.all([
    db.issueRecord.count({ where: { poId } }),
    db.bundle.findMany({
      where: { poId },
      select: {
        id: true,
        status: true,
        currentStage: true,
        finishing: { select: { id: true } },
      },
    }),
    db.salesBill.count({ where: { poId, status: "PAID" } }),
  ]);

  let nextStatus = po.status;

  if (paidSales > 0) {
    nextStatus = "COMPLETED";
  } else if (
    bundles.length > 0 &&
    bundles.every(
      (bundle) =>
        bundle.finishing.length > 0 ||
        bundle.status === "COMPLETED" ||
        bundle.currentStage === "BOXING" ||
        bundle.currentStage === "COMPLETED"
    )
  ) {
    nextStatus = "READY_TO_SHIP";
  } else if (issueCount > 0) {
    nextStatus = "IN_PRODUCTION";
  }

  if (nextStatus !== po.status) {
    await db.purchaseOrder.update({
      where: { id: poId },
      data: { status: nextStatus },
    });
  }
}

export async function list(query: POListQuery) {
  const baseWhere: Prisma.PurchaseOrderWhereInput = {};
  if (query.buyerId) baseWhere.buyerId = query.buyerId;
  if (query.search) Object.assign(baseWhere, searchWhere(query.search));

  const listWhere: Prisma.PurchaseOrderWhereInput = {
    ...baseWhere,
    ...(query.status ? { status: query.status } : {}),
  };

  const [data, total, totalActive, totalInProduction, totalReadyToShip, totalCompleted] = await prisma.$transaction([
    prisma.purchaseOrder.findMany({
      where: listWhere,
      include: {
        buyer: { select: buyerSelect },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.purchaseOrder.count({ where: listWhere }),
    prisma.purchaseOrder.count({ where: { ...baseWhere, status: "ACTIVE" } }),
    prisma.purchaseOrder.count({ where: { ...baseWhere, status: "IN_PRODUCTION" } }),
    prisma.purchaseOrder.count({ where: { ...baseWhere, status: "READY_TO_SHIP" } }),
    prisma.purchaseOrder.count({ where: { ...baseWhere, status: "COMPLETED" } }),
  ]);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalActive,
      totalInProduction,
      totalReadyToShip,
      totalCompleted,
    },
  };
}

export async function getById(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      buyer: { select: buyerSelect },
      items: true,
      purchaseBills: {
        include: {
          supplier: { select: { id: true, name: true } },
        },
        orderBy: { purchaseDate: "asc" },
      },
    },
  });

  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }

  const stages = await buildProductionStages(prisma, id);
  const { purchaseBills, ...rest } = po;

  return {
    ...rest,
    productionProgress: stages,
    fabricLots: purchaseBills.map((bill, index) => ({
      lotNumber: index + 1,
      billId: bill.id,
      billNumber: bill.billNumber,
      supplier: bill.supplier,
      date: bill.purchaseDate,
      netWeight: bill.netWeight,
      status: bill.status,
    })),
  };
}

export async function create(input: POCreateInput) {
  const buyer = await prisma.party.findUnique({ where: { id: input.buyerId } });
  if (!buyer || buyer.type !== "BUYER") {
    throw new AppError("Buyer party not found", 400, "INVALID_BUYER");
  }
  if (input.deliveryDate <= input.orderDate) {
    throw new AppError("deliveryDate must be after orderDate", 400, "INVALID_DATES");
  }

  const items = toItemRows(input.items);
  const totalPieces = items.reduce((sum, item) => sum + item.totalPieces, 0);
  const poNumber = await generatePONumber(prisma);

  const created = await prisma.$transaction(async (tx) => {
    return tx.purchaseOrder.create({
      data: {
        poNumber,
        buyerId: input.buyerId,
        buyerPoReference: input.buyerPoReference,
        orderDate: input.orderDate,
        deliveryDate: input.deliveryDate,
        shippingDestination: input.shippingDestination,
        paymentTerms: input.paymentTerms,
        specialInstructions: input.specialInstructions,
        totalPieces,
        totalDesigns: items.length,
        items: { create: items },
      },
      include: {
        buyer: { select: buyerSelect },
        items: true,
      },
    });
  });

  void notifyActiveUsers({
    type: NotificationType.PURCHASE_ORDER_CREATED,
    title: "Purchase order created",
    message: `PO ${created.poNumber} was created for ${created.buyer.name}.`,
    metadata: { entityType: "PURCHASE_ORDER", entityId: created.id },
    dedupeKey: `PO:${created.id}`,
  });

  return created;
}

export async function update(id: string, input: POUpdateInput) {
  const existing = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }
  if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
    throw new AppError("Cannot edit a completed or cancelled PO", 400, "INVALID_STATUS");
  }

  if (input.buyerId && input.buyerId !== existing.buyerId) {
    const buyer = await prisma.party.findUnique({ where: { id: input.buyerId } });
    if (!buyer || buyer.type !== "BUYER") {
      throw new AppError("Buyer party not found", 400, "INVALID_BUYER");
    }
  }

  const orderDate = input.orderDate ?? existing.orderDate;
  const deliveryDate = input.deliveryDate ?? existing.deliveryDate;
  if (deliveryDate <= orderDate) {
    throw new AppError("deliveryDate must be after orderDate", 400, "INVALID_DATES");
  }

  return prisma.$transaction(async (tx) => {
    if (input.items) {
      const items = toItemRows(input.items);
      await tx.pOItem.deleteMany({ where: { poId: id } });
      await tx.pOItem.createMany({
        data: items.map((item) => ({ ...item, poId: id })),
      });
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          totalPieces: items.reduce((sum, item) => sum + item.totalPieces, 0),
          totalDesigns: items.length,
        },
      });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        buyerId: input.buyerId,
        buyerPoReference: input.buyerPoReference,
        orderDate: input.orderDate,
        deliveryDate: input.deliveryDate,
        shippingDestination: input.shippingDestination,
        paymentTerms: input.paymentTerms,
        specialInstructions: input.specialInstructions,
      },
      include: {
        buyer: { select: buyerSelect },
        items: true,
      },
    });
  });
}

export async function cancel(id: string, input: POCancelInput) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }
  if (po.status === "CANCELLED") {
    throw new AppError("PO is already cancelled", 400, "INVALID_STATUS");
  }
  if (po.status === "COMPLETED") {
    throw new AppError("Cannot cancel a completed PO", 400, "INVALID_STATUS");
  }

  const cancelNote = `CANCELLED: ${input.reason}`;
  const specialInstructions = po.specialInstructions
    ? `${po.specialInstructions}\n${cancelNote}`
    : cancelNote;

  return prisma.purchaseOrder.update({
    where: { id },
    data: {
      status: "CANCELLED",
      specialInstructions,
    },
    include: {
      buyer: { select: buyerSelect },
      items: true,
    },
  });
}

export async function getProductionStatus(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, poNumber: true, status: true, totalPieces: true },
  });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }

  const stages = await buildProductionStages(prisma, id);
  return {
    poId: po.id,
    poNumber: po.poNumber,
    status: po.status,
    totalPieces: po.totalPieces,
    stages,
  };
}

export async function getFabricLots(id: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: { id: true, poNumber: true, totalPieces: true },
  });
  if (!po) {
    throw new AppError("Purchase order not found", 404, "NOT_FOUND");
  }

  const bills = await prisma.purchaseBill.findMany({
    where: { poId: id },
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { purchaseDate: "asc" },
  });

  const totalFabricReceived = bills
    .filter((bill) => bill.status === "CONFIRMED")
    .reduce((sum, bill) => sum + Number(bill.netWeight), 0);

  return {
    poId: po.id,
    poNumber: po.poNumber,
    totalFabricRequired: po.totalPieces,
    lots: bills.map((bill, index) => ({
      lotNumber: index + 1,
      billId: bill.id,
      billNumber: bill.billNumber,
      supplier: bill.supplier,
      date: bill.purchaseDate,
      netWeight: bill.netWeight,
      ratePerKg: bill.ratePerKg,
      totalAmount: bill.totalAmount,
      status: bill.status,
    })),
    totalFabricReceived,
  };
}
