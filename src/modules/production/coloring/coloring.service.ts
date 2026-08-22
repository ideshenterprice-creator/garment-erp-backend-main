import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateEntryNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { createPendingPayment, findAssignedOperation, requireKarigar } from "../shared";
import { ColoringCreateInput, ColoringListQuery } from "./coloring.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  bundle: { select: { id: true, bundleNumber: true, currentStage: true } },
} as const;

export async function list(query: ColoringListQuery) {
  const where: Prisma.ColoringEntryWhereInput = {};
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
    prisma.coloringEntry.findMany({
      where,
      include,
      orderBy: { entryDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.coloringEntry.count({ where }),
    prisma.coloringEntry.aggregate({ where, _sum: { piecesReturned: true } }),
    prisma.karigarPayment.aggregate({
      where: {
        productionEntryType: "COLORING",
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
  const row = await prisma.coloringEntry.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Coloring entry not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: ColoringCreateInput) {
  const bundle = await prisma.bundle.findUnique({ where: { id: input.bundleId } });
  if (!bundle) throw new AppError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.currentStage !== "COLORING") {
    throw new AppError("Bundle is not at COLORING stage", 400, "INVALID_BUNDLE_STAGE");
  }
  if (bundle.poId !== input.poId) {
    throw new AppError("bundleId does not belong to this PO", 400, "INVALID_BUNDLE");
  }

  await requireKarigar(input.karigarId);
  const operation = await findAssignedOperation(input.karigarId, "COLORING", "COLORING");

  const printing = await prisma.printingEntry.findFirst({
    where: { bundleId: input.bundleId },
    orderBy: { createdAt: "desc" },
  });
  const piecesReceived = printing?.piecesReturned ?? 0;
  if (input.piecesReturned + input.piecesRejected > piecesReceived) {
    throw new AppError(
      `piecesReturned + piecesRejected cannot exceed piecesReceived (${piecesReceived})`,
      400,
      "INVALID_PIECES"
    );
  }

  const entryNumber = await generateEntryNumber(prisma, "CLR");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.coloringEntry.create({
      data: {
        entryNumber,
        bundleId: input.bundleId,
        poId: input.poId,
        karigarId: input.karigarId,
        entryDate: input.entryDate,
        colorApplied: input.colorApplied,
        piecesReceived,
        piecesReturned: input.piecesReturned,
        piecesRejected: input.piecesRejected,
      },
      include,
    });

    await tx.bundle.update({
      where: { id: input.bundleId },
      data: { currentStage: "STITCHING" },
    });

    const { payment, calc } = await createPendingPayment({
      karigarId: input.karigarId,
      poId: input.poId,
      operationId: operation.id,
      productionEntryType: "COLORING",
      productionEntryId: entry.id,
      pieces: input.piecesReturned,
      entryDate: input.entryDate,
      tx,
    });

    await updatePOStatus(input.poId, tx);
    return { entry, payment, paymentAmount: calc.amountDue };
  });
}
