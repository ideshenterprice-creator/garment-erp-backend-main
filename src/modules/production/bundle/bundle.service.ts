import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { BundleListQuery } from "./bundle.schema";

const listInclude = {
  po: { select: { id: true, poNumber: true, status: true } },
  poItem: { select: { id: true, designNumber: true, garmentType: true, color: true } },
  issue: { select: { id: true, issueNumber: true, quantityIssued: true } },
} as const;

async function findByNumber(bundleNumber: string) {
  const bundle = await prisma.bundle.findUnique({
    where: { bundleNumber },
    include: {
      ...listInclude,
      cutting: {
        orderBy: { createdAt: "desc" },
        include: { karigar: { select: { id: true, name: true } } },
      },
      printing: {
        orderBy: { createdAt: "desc" },
        include: { karigar: { select: { id: true, name: true } } },
      },
      coloring: {
        orderBy: { createdAt: "desc" },
        include: { karigar: { select: { id: true, name: true } } },
      },
      stitching: {
        orderBy: { createdAt: "asc" },
        include: {
          karigar: { select: { id: true, name: true } },
          operation: { select: { id: true, name: true, stage: true } },
        },
      },
      finishing: {
        orderBy: { createdAt: "asc" },
        include: {
          karigar: { select: { id: true, name: true } },
          operation: { select: { id: true, name: true, stage: true } },
        },
      },
    },
  });
  if (!bundle) {
    throw new AppError("Bundle not found", 404, "NOT_FOUND");
  }
  return bundle;
}

export async function list(query: BundleListQuery) {
  const where: Prisma.BundleWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.currentStage) where.currentStage = query.currentStage;
  if (query.status) where.status = query.status;

  const [data, total] = await prisma.$transaction([
    prisma.bundle.findMany({
      where,
      include: listInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.bundle.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getByNumber(bundleNumber: string) {
  const bundle = await findByNumber(bundleNumber);
  const latestCut = bundle.cutting[0];
  return {
    bundleNumber: bundle.bundleNumber,
    poNumber: bundle.po.poNumber,
    designNumber: bundle.poItem?.designNumber ?? null,
    garmentType: bundle.poItem?.garmentType ?? null,
    fabricIssuedKg: latestCut ? Number(latestCut.fabricIssuedKg) : Number(bundle.issue?.quantityIssued ?? 0),
    currentStage: bundle.currentStage,
    status: bundle.status,
  };
}

export async function getJourney(bundleNumber: string) {
  const bundle = await findByNumber(bundleNumber);
  const cutting = bundle.cutting[0] ?? null;
  const printing = bundle.printing[0] ?? null;
  const coloring = bundle.coloring[0] ?? null;

  const box = await prisma.boxPacking.findFirst({
    where: {
      poId: bundle.poId,
      ...(bundle.poItemId ? { poItemId: bundle.poItemId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    bundleNumber: bundle.bundleNumber,
    stages: {
      cutting: cutting
        ? {
            completed: true,
            entryDate: cutting.entryDate,
            karigar: cutting.karigar,
            totalPiecesCut: cutting.totalPiecesCut,
            wastageKg: Number(cutting.wastageKg),
          }
        : null,
      printing: printing
        ? {
            completed: true,
            entryDate: printing.entryDate,
            karigar: printing.karigar,
            piecesReceived: printing.piecesReceived,
            piecesReturned: printing.piecesReturned,
            piecesRejected: printing.piecesRejected,
          }
        : null,
      coloring: coloring
        ? {
            completed: true,
            entryDate: coloring.entryDate,
            karigar: coloring.karigar,
            colorApplied: coloring.colorApplied,
            piecesReceived: coloring.piecesReceived,
            piecesReturned: coloring.piecesReturned,
            piecesRejected: coloring.piecesRejected,
          }
        : null,
      stitching:
        bundle.stitching.length > 0
          ? {
              completed: bundle.currentStage === "FINISHING" || bundle.currentStage === "BOXING" || bundle.currentStage === "COMPLETED",
              entries: bundle.stitching.map((entry) => ({
                operation: entry.operation,
                piecesGiven: entry.piecesGiven,
                piecesReturned: entry.piecesReturned,
                karigar: entry.karigar,
              })),
            }
          : null,
      finishing:
        bundle.finishing.length > 0
          ? {
              completed: bundle.status === "COMPLETED" || bundle.currentStage === "BOXING" || bundle.currentStage === "COMPLETED",
              entries: bundle.finishing.map((entry) => ({
                operation: entry.operation,
                piecesCompleted: entry.piecesCompleted,
                karigar: entry.karigar,
              })),
            }
          : null,
      boxing: {
        completed: bundle.currentStage === "BOXING" || bundle.currentStage === "COMPLETED" || Boolean(box),
        boxNumber: box?.boxNumber ?? null,
      },
    },
  };
}

export async function getPayments(bundleNumber: string) {
  const bundle = await findByNumber(bundleNumber);
  const entryIds = [
    ...bundle.cutting.map((row) => row.id),
    ...bundle.printing.map((row) => row.id),
    ...bundle.coloring.map((row) => row.id),
    ...bundle.stitching.map((row) => row.id),
    ...bundle.finishing.map((row) => row.id),
  ];

  const payments = await prisma.karigarPayment.findMany({
    where: { productionEntryId: { in: entryIds } },
    include: {
      karigar: { select: { id: true, name: true } },
      operation: { select: { id: true, name: true, stage: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const data = payments.map((payment) => ({
    karigar: payment.karigar,
    operation: payment.operation.name,
    stage: payment.operation.stage,
    piecesCompleted: payment.piecesCompleted,
    ratePerPiece: Number(payment.ratePerPiece),
    amountDue: Number(payment.amountDue),
    status: payment.status,
    paidAt: payment.paidAt,
  }));

  const totalPaymentForBundle = data.reduce((sum, row) => sum + row.amountDue, 0);
  return { data, totalPaymentForBundle };
}
