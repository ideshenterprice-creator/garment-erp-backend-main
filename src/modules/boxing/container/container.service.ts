import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateContainerNumber } from "@/utils/generateId";
import { updatePOStatus } from "@/modules/purchaseOrders/po.service";
import { AddBoxInput, ContainerCreateInput, ContainerListQuery, DispatchInput } from "./container.schema";

const include = {
  buyer: { select: { id: true, name: true, city: true, country: true } },
  po: { select: { id: true, poNumber: true, status: true } },
  boxes: true,
} as const;

function sizeTotals(boxes: Array<{
  qty_0_3M: number;
  qty_3_6M: number;
  qty_6_9M: number;
  qty_9_12M: number;
  qty_12_18M: number;
  qty_18_24M: number;
  totalPieces: number;
}>) {
  return {
    total_0_3M: boxes.reduce((sum, box) => sum + box.qty_0_3M, 0),
    total_3_6M: boxes.reduce((sum, box) => sum + box.qty_3_6M, 0),
    total_6_9M: boxes.reduce((sum, box) => sum + box.qty_6_9M, 0),
    total_9_12M: boxes.reduce((sum, box) => sum + box.qty_9_12M, 0),
    total_12_18M: boxes.reduce((sum, box) => sum + box.qty_12_18M, 0),
    total_18_24M: boxes.reduce((sum, box) => sum + box.qty_18_24M, 0),
    grandTotalPieces: boxes.reduce((sum, box) => sum + box.totalPieces, 0),
    boxCount: boxes.length,
  };
}

export async function list(query: ContainerListQuery) {
  const where: Prisma.ContainerWhereInput = {};
  if (query.poId) where.poId = query.poId;
  if (query.status) where.status = query.status;

  const [rows, total] = await prisma.$transaction([
    prisma.container.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.container.count({ where }),
  ]);

  const data = rows.map((row) => ({
    ...row,
    boxCount: row.boxes.length,
    totalPieces: row.boxes.reduce((sum, box) => sum + box.totalPieces, 0),
  }));

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const container = await prisma.container.findUnique({ where: { id }, include });
  if (!container) throw new AppError("Container not found", 404, "NOT_FOUND");
  return {
    ...container,
    sizeSummary: sizeTotals(container.boxes),
  };
}

export async function create(input: ContainerCreateInput) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: input.poId },
    include: { buyer: true },
  });
  if (!po) throw new AppError("Purchase order not found", 404, "NOT_FOUND");

  const containerNumber = await generateContainerNumber(prisma);
  return prisma.container.create({
    data: {
      containerNumber,
      poId: input.poId,
      buyerId: po.buyerId,
      destination: input.destination,
      dispatchDate: input.dispatchDate,
      status: "LOADING",
    },
    include,
  });
}

export async function addBox(id: string, input: AddBoxInput) {
  const container = await prisma.container.findUnique({ where: { id } });
  if (!container) throw new AppError("Container not found", 404, "NOT_FOUND");
  if (container.status === "DISPATCHED") {
    throw new AppError("Cannot add boxes to dispatched container", 400, "INVALID_STATUS");
  }

  const box = await prisma.boxPacking.findUnique({ where: { id: input.boxId } });
  if (!box) throw new AppError("Box not found", 404, "NOT_FOUND");
  if (box.status === "LOADED" || box.containerId) {
    throw new AppError("Box is already in another container", 400, "INVALID_STATUS");
  }
  if (box.poId !== container.poId) {
    throw new AppError("Box belongs to different PO", 400, "INVALID_PO");
  }

  await prisma.boxPacking.update({
    where: { id: box.id },
    data: { containerId: container.id, status: "LOADED" },
  });

  const updated = await getById(id);
  return { ...updated, boxCount: updated.boxes.length };
}

export async function markReady(id: string) {
  const container = await prisma.container.findUnique({
    where: { id },
    include: { boxes: true },
  });
  if (!container) throw new AppError("Container not found", 404, "NOT_FOUND");
  if (container.boxes.length === 0) {
    throw new AppError("Add boxes before marking ready", 400, "INVALID_STATUS");
  }
  return prisma.container.update({
    where: { id },
    data: { status: "READY" },
    include,
  });
}

export async function markDispatched(id: string, input: DispatchInput) {
  const container = await prisma.container.findUnique({ where: { id } });
  if (!container) throw new AppError("Container not found", 404, "NOT_FOUND");
  if (container.status !== "READY") {
    throw new AppError("Container must be marked Ready before dispatching", 400, "INVALID_STATUS");
  }

  const updated = await prisma.container.update({
    where: { id },
    data: { status: "DISPATCHED", dispatchDate: input.dispatchDate },
    include,
  });
  await updatePOStatus(container.poId, prisma);
  return updated;
}
