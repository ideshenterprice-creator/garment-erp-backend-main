import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateEntryNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { assignedOperationIds, assertOperationAssigned, createPendingPayment, removeProductionEntry, requireKarigar } from "../shared";
import { StitchingCreateInput, StitchingListQuery } from "./stitching.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  bundle: { select: { id: true, bundleNumber: true, currentStage: true } },
  operation: { select: { id: true, name: true, stage: true, ratePerPiece: true } },
} as const;

export async function list(query: StitchingListQuery) {
  const where: Prisma.StitchingEntryWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.bundleId) where.bundleId = query.bundleId;
  if (query.from || query.to) {
    where.entryDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total, returned, payments] = await prisma.$transaction([
    prisma.stitchingEntry.findMany({
      where,
      include,
      orderBy: { entryDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.stitchingEntry.count({ where }),
    prisma.stitchingEntry.aggregate({ where, _sum: { piecesReturned: true } }),
    prisma.karigarPayment.aggregate({
      where: {
        productionEntryType: "STITCHING",
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
      totalPiecesReturned: returned._sum.piecesReturned ?? 0,
      totalKarigarPaymentDue: Number(payments._sum.amountDue ?? 0),
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.stitchingEntry.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Stitching entry not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: StitchingCreateInput) {
  const bundle = await prisma.bundle.findUnique({ where: { id: input.bundleId } });
  if (!bundle) throw new AppError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.currentStage !== "STITCHING") {
    throw new AppError("Bundle is not at STITCHING stage", 400, "INVALID_BUNDLE_STAGE");
  }
  if (bundle.poId !== input.poId) {
    throw new AppError("bundleId does not belong to this PO", 400, "INVALID_BUNDLE");
  }

  await requireKarigar(input.karigarId);
  await assertOperationAssigned(input.karigarId, input.operationId, "STITCHING");

  if (input.piecesReturned + input.piecesRejected > input.piecesGiven) {
    throw new AppError(
      "piecesReturned + piecesRejected cannot exceed piecesGiven",
      400,
      "INVALID_PIECES"
    );
  }

  const entryNumber = await generateEntryNumber(prisma, "STH");
  const requiredOps = await assignedOperationIds(input.karigarId, "STITCHING");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.stitchingEntry.create({
      data: {
        entryNumber,
        bundleId: input.bundleId,
        poId: input.poId,
        karigarId: input.karigarId,
        operationId: input.operationId,
        entryDate: input.entryDate,
        piecesGiven: input.piecesGiven,
        piecesReturned: input.piecesReturned,
        piecesRejected: input.piecesRejected,
      },
      include,
    });

    const recorded = await tx.stitchingEntry.findMany({
      where: { bundleId: input.bundleId, karigarId: input.karigarId },
      select: { operationId: true },
    });
    const recordedIds = new Set(recorded.map((row) => row.operationId));
    const allDone = requiredOps.length > 0 && requiredOps.every((id) => recordedIds.has(id));

    if (allDone) {
      await tx.bundle.update({
        where: { id: input.bundleId },
        data: { currentStage: "FINISHING" },
      });
    }

    const { payment, calc } = await createPendingPayment({
      karigarId: input.karigarId,
      poId: input.poId,
      operationId: input.operationId,
      productionEntryType: "STITCHING",
      productionEntryId: entry.id,
      pieces: input.piecesReturned,
      entryDate: input.entryDate,
      tx,
    });

    await updatePOStatus(input.poId, tx);
    return { entry, payment, paymentAmount: calc.amountDue, allStitchingDone: allDone };
  });
}

export async function remove(id: string) {
  const entry = await prisma.stitchingEntry.findUnique({
    where: { id },
    select: { id: true, bundleId: true, poId: true },
  });
  const finishing = entry
    ? await prisma.finishingEntry.count({ where: { bundleId: entry.bundleId } })
    : 0;

  return removeProductionEntry({
    id,
    type: "STITCHING",
    notFoundMessage: "Stitching entry not found",
    find: async () => entry,
    laterBlockers: finishing > 0 ? [`${finishing} finishing entry(ies)`] : [],
    revertStage: "STITCHING",
    deleteEntry: (tx, entryId) => tx.stitchingEntry.delete({ where: { id: entryId } }),
  });
}
