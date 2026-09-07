import {
  BundleStage,
  Prisma,
  PrismaClient,
  ProductionEntryType,
  ProductionStage,
} from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { generateKPNumber } from "@/utils/generateId";
import { calculateKarigarPayment } from "@/utils/paymentCalculator";
import { reverseStockByReference } from "@/utils/stockReverse";

export type TxClient = PrismaClient | Prisma.TransactionClient;

export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export async function requireKarigar(karigarId: string) {
  const party = await prisma.party.findUnique({ where: { id: karigarId } });
  if (!party || party.type !== "KARIGAR") {
    throw new AppError("Karigar party not found", 400, "INVALID_KARIGAR");
  }
  return party;
}

export async function findAssignedOperation(
  karigarId: string,
  stage: ProductionStage,
  nameHint?: string
) {
  const profile = await prisma.karigarProfile.findUnique({
    where: { partyId: karigarId },
    include: {
      operations: {
        include: { operation: true },
      },
    },
  });

  if (!profile) {
    throw new AppError("Karigar profile not found for this party", 400, "KARIGAR_PROFILE_MISSING");
  }

  const assigned = profile.operations
    .map((item) => item.operation)
    .filter((operation) => operation.stage === stage && operation.isActive);

  if (assigned.length === 0) {
    throw new AppError(`Karigar has no ${stage} operations assigned`, 400, "OPERATION_NOT_ASSIGNED");
  }

  if (nameHint) {
    const hinted = assigned.find((operation) =>
      operation.name.toUpperCase().includes(nameHint.toUpperCase())
    );
    if (hinted) return hinted;
  }

  return assigned[0];
}

export async function assertOperationAssigned(
  karigarId: string,
  operationId: string,
  stage: ProductionStage
) {
  const operation = await prisma.operation.findUnique({ where: { id: operationId } });
  if (!operation || !operation.isActive) {
    throw new AppError("Operation not found or inactive", 404, "OPERATION_NOT_FOUND");
  }
  if (operation.stage !== stage) {
    throw new AppError(`Operation must be a ${stage} stage operation`, 400, "INVALID_OPERATION_STAGE");
  }

  const profile = await prisma.karigarProfile.findUnique({ where: { partyId: karigarId } });
  if (!profile) {
    throw new AppError("Karigar profile not found for this party", 400, "KARIGAR_PROFILE_MISSING");
  }

  const assigned = await prisma.karigarOperation.findUnique({
    where: {
      karigarProfileId_operationId: {
        karigarProfileId: profile.id,
        operationId,
      },
    },
  });
  if (!assigned) {
    throw new AppError("This operation is not assigned to this karigar", 400, "OPERATION_NOT_ASSIGNED");
  }

  return { operation, profile };
}

export async function assignedOperationIds(karigarId: string, stage: ProductionStage): Promise<string[]> {
  const profile = await prisma.karigarProfile.findUnique({
    where: { partyId: karigarId },
    include: {
      operations: { include: { operation: true } },
    },
  });
  if (!profile) return [];
  return profile.operations
    .filter((item) => item.operation.stage === stage && item.operation.isActive)
    .map((item) => item.operationId);
}

export async function createPendingPayment(params: {
  karigarId: string;
  poId: string;
  operationId: string;
  productionEntryType: ProductionEntryType;
  productionEntryId: string;
  pieces: number;
  entryDate: Date;
  tx: TxClient;
}) {
  const calc = await calculateKarigarPayment(params.operationId, params.pieces, prisma);
  const paymentNumber = await generateKPNumber(prisma);
  const { week, year } = isoWeek(params.entryDate);

  const payment = await params.tx.karigarPayment.create({
    data: {
      paymentNumber,
      karigarId: params.karigarId,
      poId: params.poId,
      operationId: params.operationId,
      productionEntryType: params.productionEntryType,
      productionEntryId: params.productionEntryId,
      piecesCompleted: params.pieces,
      ratePerPiece: calc.rate,
      amountDue: calc.amountDue,
      weekNumber: week,
      year,
      status: "PENDING",
    },
    include: {
      operation: { select: { id: true, name: true, stage: true, ratePerPiece: true } },
    },
  });

  return { payment, calc };
}

export async function findFinishedGoodProduct() {
  return prisma.product.findFirst({
    where: { category: "FINISHED_GOOD", isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function addProductionStock(params: {
  tx: TxClient;
  productId: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  userId: string;
  notes: string;
}) {
  const stock = await params.tx.stock.findUnique({ where: { productId: params.productId } });
  if (!stock) {
    await params.tx.stock.create({
      data: { productId: params.productId, quantity: params.quantity },
    });
  } else {
    await params.tx.stock.update({
      where: { productId: params.productId },
      data: { quantity: { increment: params.quantity } },
    });
  }

  await params.tx.stockTransaction.create({
    data: {
      productId: params.productId,
      transactionType: "PRODUCTION_IN",
      quantity: params.quantity,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      notes: params.notes,
      createdById: params.userId,
    },
  });
}

export async function removeProductionEntry(params: {
  id: string;
  type: ProductionEntryType;
  notFoundMessage: string;
  find: () => Promise<{ id: string; bundleId: string; poId: string } | null>;
  laterBlockers: string[];
  revertStage: BundleStage;
  stockReferenceType?: string;
  deleteEntry: (tx: TxClient, id: string) => Promise<unknown>;
}): Promise<{ id: string; message: string }> {
  const entry = await params.find();
  if (!entry) {
    throw new AppError(params.notFoundMessage, 404, "NOT_FOUND");
  }

  if (params.laterBlockers.length > 0) {
    throw new AppError(
      `Cannot delete: later production records exist (${params.laterBlockers.join(", ")}). Delete those first.`,
      409,
      "ENTRY_IN_USE"
    );
  }

  const paid = await prisma.karigarPayment.count({
    where: {
      productionEntryType: params.type,
      productionEntryId: entry.id,
      status: { in: ["PAID", "PARTIALLY_PAID"] },
    },
  });
  if (paid > 0) {
    throw new AppError(
      "Cannot delete: karigar payment already recorded for this entry.",
      409,
      "PAYMENT_PAID"
    );
  }

  await prisma.$transaction(async (tx) => {
    if (params.stockReferenceType) {
      await reverseStockByReference(tx, params.stockReferenceType, entry.id);
    }
    await tx.karigarPayment.deleteMany({
      where: {
        productionEntryType: params.type,
        productionEntryId: entry.id,
      },
    });
    await params.deleteEntry(tx, entry.id);
    await tx.bundle.update({
      where: { id: entry.bundleId },
      data: { currentStage: params.revertStage, status: "IN_PROGRESS" },
    });
    await updatePOStatus(entry.poId, tx);
  });

  return { id: entry.id, message: "Deleted permanently" };
}
