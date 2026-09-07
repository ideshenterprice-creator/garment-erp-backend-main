import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateEntryNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import {
  addProductionStock,
  createPendingPayment,
  findAssignedOperation,
  findFinishedGoodProduct,
  removeProductionEntry,
  requireKarigar,
} from "../shared";
import { CuttingCreateInput, CuttingListQuery } from "./cutting.schema";

const include = {
  karigar: { select: { id: true, name: true, partyNumber: true } },
  po: { select: { id: true, poNumber: true } },
  bundle: { select: { id: true, bundleNumber: true, currentStage: true } },
  poItem: true,
} as const;

function itemTotal(input: CuttingCreateInput): number {
  return (
    input.qty_0_3M +
    input.qty_3_6M +
    input.qty_6_9M +
    input.qty_9_12M +
    input.qty_12_18M +
    input.qty_18_24M
  );
}

export async function list(query: CuttingListQuery) {
  const where: Prisma.CuttingEntryWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.karigarId) where.karigarId = query.karigarId;
  if (query.bundleId) where.bundleId = query.bundleId;
  if (query.from || query.to) {
    where.entryDate = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total, pieces, wastage, payments] = await prisma.$transaction([
    prisma.cuttingEntry.findMany({
      where,
      include,
      orderBy: { entryDate: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.cuttingEntry.count({ where }),
    prisma.cuttingEntry.aggregate({ where, _sum: { totalPiecesCut: true } }),
    prisma.cuttingEntry.aggregate({ where, _sum: { wastageKg: true } }),
    prisma.karigarPayment.aggregate({
      where: {
        productionEntryType: "CUTTING",
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
      totalPiecesCut: pieces._sum.totalPiecesCut ?? 0,
      totalWastageKg: Number(wastage._sum.wastageKg ?? 0),
      totalKarigarPaymentDue: Number(payments._sum.amountDue ?? 0),
    },
  };
}

export async function getById(id: string) {
  const row = await prisma.cuttingEntry.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Cutting entry not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: CuttingCreateInput, userId: string) {
  const bundle = await prisma.bundle.findUnique({
    where: { id: input.bundleId },
    include: { issue: true },
  });
  if (!bundle) throw new AppError("Bundle not found", 404, "NOT_FOUND");
  if (bundle.currentStage !== "CUTTING") {
    throw new AppError("Bundle is not at CUTTING stage", 400, "INVALID_BUNDLE_STAGE");
  }
  if (bundle.poId !== input.poId) {
    throw new AppError("bundleId does not belong to this PO", 400, "INVALID_BUNDLE");
  }

  await requireKarigar(input.karigarId);
  const operation = await findAssignedOperation(input.karigarId, "CUTTING");
  const totalPiecesCut = itemTotal(input);
  const fabricIssuedKg =
    input.fabricIssuedKg != null
      ? input.fabricIssuedKg
      : bundle.issue
        ? Number(bundle.issue.quantityIssued)
        : 0;
  const entryNumber = await generateEntryNumber(prisma, "CUT");
  const fgProduct = await findFinishedGoodProduct();

  return prisma.$transaction(async (tx) => {
    const entry = await tx.cuttingEntry.create({
      data: {
        entryNumber,
        bundleId: input.bundleId,
        poId: input.poId,
        poItemId: input.poItemId,
        karigarId: input.karigarId,
        entryDate: input.entryDate,
        fabricIssuedKg,
        totalPiecesCut,
        qty_0_3M: input.qty_0_3M,
        qty_3_6M: input.qty_3_6M,
        qty_6_9M: input.qty_6_9M,
        qty_9_12M: input.qty_9_12M,
        qty_12_18M: input.qty_12_18M,
        qty_18_24M: input.qty_18_24M,
        wastageKg: input.wastageKg,
      },
      include,
    });

    await tx.bundle.update({
      where: { id: input.bundleId },
      data: { currentStage: "PRINTING" },
    });

    if (fgProduct && totalPiecesCut > 0) {
      await addProductionStock({
        tx,
        productId: fgProduct.id,
        quantity: totalPiecesCut,
        referenceType: "CUTTING_ENTRY",
        referenceId: entry.id,
        userId,
        notes: entryNumber,
      });
    }

    const { payment, calc } = await createPendingPayment({
      karigarId: input.karigarId,
      poId: input.poId,
      operationId: operation.id,
      productionEntryType: "CUTTING",
      productionEntryId: entry.id,
      pieces: totalPiecesCut,
      entryDate: input.entryDate,
      tx,
    });

    await updatePOStatus(input.poId, tx);

    return { entry, payment, paymentAmount: calc.amountDue };
  });
}

export async function remove(id: string) {
  const entry = await prisma.cuttingEntry.findUnique({
    where: { id },
    select: { id: true, bundleId: true, poId: true },
  });
  const bundleId = entry?.bundleId;
  const [printing, coloring, stitching, finishing] = bundleId
    ? await Promise.all([
        prisma.printingEntry.count({ where: { bundleId } }),
        prisma.coloringEntry.count({ where: { bundleId } }),
        prisma.stitchingEntry.count({ where: { bundleId } }),
        prisma.finishingEntry.count({ where: { bundleId } }),
      ])
    : [0, 0, 0, 0];

  const laterBlockers: string[] = [];
  if (printing > 0) laterBlockers.push(`${printing} printing entry(ies)`);
  if (coloring > 0) laterBlockers.push(`${coloring} coloring entry(ies)`);
  if (stitching > 0) laterBlockers.push(`${stitching} stitching entry(ies)`);
  if (finishing > 0) laterBlockers.push(`${finishing} finishing entry(ies)`);

  return removeProductionEntry({
    id,
    type: "CUTTING",
    notFoundMessage: "Cutting entry not found",
    find: async () => entry,
    laterBlockers,
    revertStage: "CUTTING",
    stockReferenceType: "CUTTING_ENTRY",
    deleteEntry: (tx, entryId) => tx.cuttingEntry.delete({ where: { id: entryId } }),
  });
}
