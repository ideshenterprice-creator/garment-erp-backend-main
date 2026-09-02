import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { generateVoucherNumber } from "@/utils/generateId";
import { VoucherCreateInput, VoucherListQuery } from "./voucher.schema";

const include = {
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export async function list(query: VoucherListQuery) {
  const where: Prisma.VoucherWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = query.from;
    if (query.to) where.date.lte = query.to;
  }

  const [data, total] = await prisma.$transaction([
    prisma.voucher.findMany({
      where,
      include,
      orderBy: { date: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.voucher.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const row = await prisma.voucher.findUnique({ where: { id }, include });
  if (!row) throw new AppError("Voucher not found", 404, "NOT_FOUND");
  return row;
}

export async function create(input: VoucherCreateInput, userId: string) {
  const voucherNumber = await generateVoucherNumber(prisma);
  return prisma.voucher.create({
    data: {
      voucherNumber,
      type: input.type,
      partyDescription: input.partyDescription,
      amount: input.amount,
      paymentMode: input.paymentMode,
      referenceNo: input.referenceNo,
      date: input.date,
      notes: input.notes,
      createdById: userId,
    },
    include,
  });
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  await getById(id);
  await prisma.voucher.delete({ where: { id } });
  return { id, message: "Deleted permanently" };
}
