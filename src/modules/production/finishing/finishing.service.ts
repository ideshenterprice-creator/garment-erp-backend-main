import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateEntryNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import {
  addProductionStock,
  assignedOperationIds,
  assertOperationAssigned,
  createPendingPayment,
  findFinishedGoodProduct,
  requireKarigar,
} from "../shared";
import { FinishingCreateInput, FinishingListQuery } from "./finishing.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  bundle: { select: { id: true, bundleNumber: true, currentStage: true, status: true } },
  operation: { select: { id: true, name: true, stage: true, ratePerPiece: true } },
} as const;

export async function list(query: FinishingListQuery) {
  const where: Prisma.FinishingEntryWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.bundleId) where.bundleId = query.bundleId;
  if (query.from || query.to) {
    where.entryDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total, completed, payments] = await prisma.$transaction([
    prisma.finishingEntry.findMany({
      where,
      include,
      orderBy: { entryDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.finishingEntry.count({ where }),
    prisma.finishingEntry.aggregate({ where, _sum: { piecesCompleted: true } }),
    prisma.karigarPayment.aggregate({
      where: {
        productionEntryType: "FINISHING",
        status: "PENDING",
        ...(query.poId ? { poId: query.poId } : {}),
        ...(query.karigarId ? { karigarId: query.karigarId } : {}),
      },
      _sum: { amountDue: true },
    }),
  ]);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    summary: {
      totalPiecesCompleted: completed._sum.piecesCompleted ?? 0,
      totalKarigarPaymentDue: Number(payments._sum.amountDue ?? 0),
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.finishingEntry.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Finishing entry not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: FinishingCreateInput, userId: string) {
  const bundle = await prisma.bundle.findUnique({ where: { id: input.bundleId } });
  if (!bundle) throw new AppError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.currentStage !== "FINISHING") {
    throw new AppError("Bundle is not at FINISHING stage", 400, "INVALID_BUNDLE_STAGE");
  }
  if (bundle.poId !== input.poId) {
    throw new AppError("bundleId does not belong to this PO", 400, "INVALID_BUNDLE");
  }

  await requireKarigar(input.karigarId);
  await assertOperationAssigned(input.karigarId, input.operationId, "FINISHING");

  if (input.piecesCompleted > input.piecesReceived) {
    throw new AppError("piecesCompleted cannot exceed piecesReceived", 400, "INVALID_PIECES");
  }

  const entryNumber = await generateEntryNumber(prisma, "FIN");
  const requiredOps = await assignedOperationIds(input.karigarId, "FINISHING");
  const fgProduct = await findFinishedGoodProduct();

  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.finishingEntry.create({
      data: {
        entryNumber,
        bundleId: input.bundleId,
        poId: input.poId,
        karigarId: input.karigarId,
        operationId: input.operationId,
        entryDate: input.entryDate,
        piecesReceived: input.piecesReceived,
        piecesCompleted: input.piecesCompleted,
      },
      include,
    });

    let stockUpdated = false;
    if (fgProduct && input.piecesCompleted > 0) {
      await addProductionStock({
        tx,
        productId: fgProduct.id,
        quantity: input.piecesCompleted,
        referenceType: "FINISHING_ENTRY",
        referenceId: entry.id,
        userId,
        notes: entryNumber,
      });
      stockUpdated = true;
    }

    const recorded = await tx.finishingEntry.findMany({
      where: { bundleId: input.bundleId, karigarId: input.karigarId },
      select: { operationId: true },
    });
    const recordedIds = new Set(recorded.map((row) => row.operationId));
    const allDone = requiredOps.length > 0 && requiredOps.every((id) => recordedIds.has(id));

    if (allDone) {
      await tx.bundle.update({
        where: { id: input.bundleId },
        data: { currentStage: "BOXING", status: "COMPLETED" },
      });
    }

    const { payment, calc } = await createPendingPayment({
      karigarId: input.karigarId,
      poId: input.poId,
      operationId: input.operationId,
      productionEntryType: "FINISHING",
      productionEntryId: entry.id,
      pieces: input.piecesCompleted,
      entryDate: input.entryDate,
      tx,
    });

    await updatePOStatus(input.poId, tx);
    return {
      entry,
      payment,
      paymentAmount: calc.amountDue,
      stockUpdated,
      allFinishingDone: allDone,
    };
  });

  if (result.allFinishingDone) {
    const { notifyActiveUsers, NotificationType } = await import(
      "@/modules/notifications/notification.service"
    );
    void notifyActiveUsers({
      type: NotificationType.PRODUCTION_COMPLETED,
      title: "Production completed",
      message: `Bundle ${bundle.bundleNumber} finished and moved to boxing.`,
      metadata: {
        entityType: "BUNDLE",
        entityId: bundle.id,
        bundleNumber: bundle.bundleNumber,
      },
      dedupeKey: `PRODUCTION_COMPLETED:${bundle.id}`,
    });
  }

  return result;
}
