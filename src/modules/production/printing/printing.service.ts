import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateEntryNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { createPendingPayment, findAssignedOperation, removeProductionEntry, requireKarigar } from "../shared";
import { PrintingCreateInput, PrintingListQuery } from "./printing.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  bundle: { select: { id: true, bundleNumber: true, currentStage: true } },
} as const;

export async function list(query: PrintingListQuery) {
  const where: Prisma.PrintingEntryWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.bundleId) where.bundleId = query.bundleId;
  if (query.from || query.to) {
    where.entryDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total, returned, rejected, payments] = await prisma.$transaction([
    prisma.printingEntry.findMany({
      where,
      include,
      orderBy: { entryDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.printingEntry.count({ where }),
    prisma.printingEntry.aggregate({ where, _sum: { piecesReturned: true } }),
    prisma.printingEntry.aggregate({ where, _sum: { piecesRejected: true } }),
    prisma.karigarPayment.aggregate({
      where: {
        productionEntryType: "PRINTING",
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
      totalPiecesRejected: rejected._sum.piecesRejected ?? 0,
      totalKarigarPaymentDue: Number(payments._sum.amountDue ?? 0),
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.printingEntry.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Printing entry not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: PrintingCreateInput) {
  const bundle = await prisma.bundle.findUnique({ where: { id: input.bundleId } });
  if (!bundle) throw new AppError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.currentStage !== "PRINTING") {
    throw new AppError("Bundle is not at PRINTING stage", 400, "INVALID_BUNDLE_STAGE");
  }
  if (bundle.poId !== input.poId) {
    throw new AppError("bundleId does not belong to this PO", 400, "INVALID_BUNDLE");
  }

  await requireKarigar(input.karigarId);
  const operation = await findAssignedOperation(input.karigarId, "PRINTING", "SCREEN_PRINTING");

  const cutting = await prisma.cuttingEntry.findFirst({
    where: { bundleId: input.bundleId },
    orderBy: { createdAt: "desc" },
  });
  const piecesReceived = cutting?.totalPiecesCut ?? 0;
  if (input.piecesReturned + input.piecesRejected > piecesReceived) {
    throw new AppError(
      `piecesReturned + piecesRejected cannot exceed piecesReceived (${piecesReceived})`,
      400,
      "INVALID_PIECES"
    );
  }

  const entryNumber = await generateEntryNumber(prisma, "PRT");

  return prisma.$transaction(async (tx) => {
    const entry = await tx.printingEntry.create({
      data: {
        entryNumber,
        bundleId: input.bundleId,
        poId: input.poId,
        karigarId: input.karigarId,
        entryDate: input.entryDate,
        piecesReceived,
        piecesReturned: input.piecesReturned,
        piecesRejected: input.piecesRejected,
      },
      include,
    });

    await tx.bundle.update({
      where: { id: input.bundleId },
      data: { currentStage: "COLORING" },
    });

    const { payment, calc } = await createPendingPayment({
      karigarId: input.karigarId,
      poId: input.poId,
      operationId: operation.id,
      productionEntryType: "PRINTING",
      productionEntryId: entry.id,
      pieces: input.piecesReturned,
      entryDate: input.entryDate,
      tx,
    });

    await updatePOStatus(input.poId, tx);
    return { entry, payment, paymentAmount: calc.amountDue };
  });
}

export async function remove(id: string) {
  const entry = await prisma.printingEntry.findUnique({
    where: { id },
    select: { id: true, bundleId: true, poId: true },
  });
  const bundleId = entry?.bundleId;
  const [coloring, stitching, finishing] = bundleId
    ? await Promise.all([
        prisma.coloringEntry.count({ where: { bundleId } }),
        prisma.stitchingEntry.count({ where: { bundleId } }),
        prisma.finishingEntry.count({ where: { bundleId } }),
      ])
    : [0, 0, 0];

  const laterBlockers: string[] = [];
  if (coloring > 0) laterBlockers.push(`${coloring} coloring entry(ies)`);
  if (stitching > 0) laterBlockers.push(`${stitching} stitching entry(ies)`);
  if (finishing > 0) laterBlockers.push(`${finishing} finishing entry(ies)`);

  return removeProductionEntry({
    id,
    type: "PRINTING",
    notFoundMessage: "Printing entry not found",
    find: async () => entry,
    laterBlockers,
    revertStage: "PRINTING",
    deleteEntry: (tx, entryId) => tx.printingEntry.delete({ where: { id: entryId } }),
  });
}
