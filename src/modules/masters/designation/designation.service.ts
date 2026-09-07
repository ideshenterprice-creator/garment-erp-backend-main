import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import {
  DesignationCreateInput,
  DesignationListQuery,
  DesignationStatusInput,
  DesignationUpdateInput,
} from "./designation.schema";

function slugCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function list(query: DesignationListQuery) {
  const where: Prisma.DesignationWhereInput = {};
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await prisma.$transaction([
    prisma.designation.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.designation.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const row = await prisma.designation.findUnique({ where: { id } });
  if (!row) throw new AppError("Designation not found", 404, "NOT_FOUND");
  return row;
}

async function assertNameUnique(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.designation.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new AppError("Designation name already exists", 409, "DUPLICATE_NAME");
  }
}

export async function create(input: DesignationCreateInput) {
  const name = input.name.trim();
  await assertNameUnique(name);
  const code = input.code?.trim() || slugCode(name);
  const existing = await prisma.designation.findUnique({ where: { code } });
  if (existing) {
    throw new AppError("Designation code already exists", 409, "DUPLICATE_CODE");
  }
  return prisma.designation.create({
    data: {
      name,
      code,
      description: input.description?.trim(),
    },
  });
}

export async function update(id: string, input: DesignationUpdateInput) {
  await getById(id);
  if (input.name) {
    await assertNameUnique(input.name.trim(), id);
  }
  if (input.code) {
    const duplicate = await prisma.designation.findFirst({
      where: { code: input.code, NOT: { id } },
    });
    if (duplicate) {
      throw new AppError("Designation code already exists", 409, "DUPLICATE_CODE");
    }
  }
  return prisma.designation.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      code: input.code?.trim(),
      description: input.description?.trim(),
    },
  });
}

export async function updateStatus(id: string, input: DesignationStatusInput) {
  await getById(id);
  return prisma.designation.update({
    where: { id },
    data: { isActive: input.isActive },
  });
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  await getById(id);
  const linked = await prisma.karigarProfile.count({ where: { designationId: id } });
  if (linked > 0) {
    throw new AppError(
      "Cannot delete designation linked to karigar profiles",
      409,
      "DESIGNATION_IN_USE"
    );
  }
  await prisma.designation.delete({ where: { id } });
  return { id, message: "Designation deleted permanently" };
}
