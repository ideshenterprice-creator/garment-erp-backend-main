import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { GstCreateInput, GstUpdateInput } from "./gst.schema";

async function assertCategoryUnique(category: string, excludeId?: string): Promise<void> {
  const existing = await prisma.gSTRate.findFirst({
    where: {
      category,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new AppError("GST category must be unique", 400, "ALREADY_EXISTS");
  }
}

export async function list() {
  return prisma.gSTRate.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getById(id: string) {
  const rate = await prisma.gSTRate.findUnique({ where: { id } });
  if (!rate) {
    throw new AppError("GST rate not found", 404, "NOT_FOUND");
  }
  return rate;
}

export async function create(input: GstCreateInput) {
  await assertCategoryUnique(input.category);
  return prisma.gSTRate.create({ data: input });
}

export async function update(id: string, input: GstUpdateInput) {
  await getById(id);
  if (input.category) {
    await assertCategoryUnique(input.category, id);
  }
  return prisma.gSTRate.update({ where: { id }, data: input });
}
