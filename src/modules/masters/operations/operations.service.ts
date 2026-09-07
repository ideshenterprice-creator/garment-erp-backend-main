import { OperationDepartment, Prisma, UnitOfMeasure } from "@prisma/client";
import prisma from "@/config/database";
import logger from "@/config/logger";
import { AppError } from "@/middleware/errorHandler";
import {
  OperationCreateInput,
  OperationListQuery,
  OperationStatusInput,
  OperationUpdateInput,
} from "./operations.schema";

const RATE_UPDATE_NOTE =
  "Rate updated. All future payments will use new rate. Existing pending payments are not affected.";

function toUnitOfMeasure(unit: string | undefined): UnitOfMeasure {
  if (!unit || unit === "per piece") {
    return UnitOfMeasure.PCS;
  }
  const normalized = unit.toUpperCase();
  if (normalized === "KG" || normalized === "PCS" || normalized === "METERS" || normalized === "ROLLS") {
    return normalized;
  }
  return UnitOfMeasure.PCS;
}

function withRateLock<T extends { createdAt: Date }>(operation: T) {
  return {
    ...operation,
    rateLockedAt: operation.createdAt,
  };
}

async function nextOperationCode(): Promise<string> {
  const count = await prisma.operation.count({
    where: { operationCode: { startsWith: "OP-" } },
  });
  return `OP-${String(count + 1).padStart(3, "0")}`;
}

export async function list(query: OperationListQuery) {
  const where: Prisma.OperationWhereInput = {};
  if (query.stage) where.stage = query.stage;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }
  if (query.department) {
    where.department = { contains: query.department, mode: "insensitive" };
  }
  if (query.departmentType) {
    where.departmentType = query.departmentType as OperationDepartment;
  }
  if (query.lotNo) {
    where.lotNo = { contains: query.lotNo, mode: "insensitive" };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.operation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.operation.count({ where }),
  ]);

  return {
    data: rows.map(withRateLock),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getById(id: string) {
  const operation = await prisma.operation.findUnique({ where: { id } });
  if (!operation) {
    throw new AppError("Operation not found", 404, "NOT_FOUND");
  }
  return withRateLock(operation);
}

export async function create(input: OperationCreateInput) {
  const operationCode = await nextOperationCode();
  const operation = await prisma.operation.create({
    data: {
      operationCode,
      name: input.name,
      stage: input.stage,
      ratePerPiece: input.ratePerPiece,
      unit: toUnitOfMeasure(input.unit),
      lotNo: input.lotNo,
      department: input.department,
      departmentType: input.departmentType,
    },
  });
  return withRateLock(operation);
}

export async function update(id: string, input: OperationUpdateInput) {
  const existing = await prisma.operation.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Operation not found", 404, "NOT_FOUND");
  }

  const rateChanged =
    input.ratePerPiece !== undefined && Number(existing.ratePerPiece) !== input.ratePerPiece;

  if (rateChanged && input.ratePerPiece !== undefined) {
    logger.info("Operation rate updated", {
      operationId: id,
      previousRate: Number(existing.ratePerPiece),
      newRate: input.ratePerPiece,
      changedAt: new Date().toISOString(),
    });
  }

  const updated = await prisma.operation.update({
    where: { id },
    data: {
      name: input.name,
      stage: input.stage,
      ratePerPiece: input.ratePerPiece,
      unit: input.unit !== undefined ? toUnitOfMeasure(input.unit) : undefined,
      lotNo: input.lotNo,
      department: input.department,
      departmentType: input.departmentType,
    },
  });

  return {
    ...withRateLock(updated),
    previousRate: rateChanged ? Number(existing.ratePerPiece) : undefined,
    rateChangedAt: rateChanged ? new Date() : undefined,
    note: rateChanged ? RATE_UPDATE_NOTE : undefined,
  };
}

export async function updateStatus(id: string, input: OperationStatusInput) {
  await getById(id);
  const updated = await prisma.operation.update({
    where: { id },
    data: { isActive: input.isActive },
  });
  return withRateLock(updated);
}

async function assertOperationCanBeDeleted(id: string): Promise<void> {
  const [stitching, finishing, payments] = await Promise.all([
    prisma.stitchingEntry.count({ where: { operationId: id } }),
    prisma.finishingEntry.count({ where: { operationId: id } }),
    prisma.karigarPayment.count({ where: { operationId: id } }),
  ]);

  const blockers: string[] = [];
  if (stitching > 0) blockers.push(`${stitching} stitching entry(ies)`);
  if (finishing > 0) blockers.push(`${finishing} finishing entry(ies)`);
  if (payments > 0) blockers.push(`${payments} karigar payment(s)`);

  if (blockers.length > 0) {
    throw new AppError(
      `Cannot delete operation linked to ${blockers.join(", ")}. Remove or reassign those records first.`,
      409,
      "OPERATION_IN_USE"
    );
  }
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  await getById(id);
  await assertOperationCanBeDeleted(id);

  await prisma.$transaction(async (tx) => {
    await tx.karigarOperation.deleteMany({ where: { operationId: id } });
    await tx.operation.delete({ where: { id } });
  });

  return { id, message: "Operation deleted permanently" };
}
