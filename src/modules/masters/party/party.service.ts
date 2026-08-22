import { PartyType, Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { PartyCreateInput, PartyListQuery, PartyStatusInput, PartyUpdateInput } from "./party.schema";

const PARTY_PREFIX: Record<PartyType, string> = {
  BUYER: "BUY-",
  SUPPLIER: "SUP-",
  KARIGAR: "KAR-",
};

async function nextPartyNumber(type: PartyType): Promise<string> {
  const prefix = PARTY_PREFIX[type];
  const count = await prisma.party.count({ where: { partyNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

async function assertNameTypeUnique(name: string, type: PartyType, excludeId?: string): Promise<void> {
  const existing = await prisma.party.findFirst({
    where: {
      name,
      type,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new AppError("A party with this name and type already exists", 400, "ALREADY_EXISTS");
  }
}

export async function list(query: PartyListQuery) {
  const where: Prisma.PartyWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
  }

  const [data, total] = await prisma.$transaction([
    prisma.party.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.party.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const party = await prisma.party.findUnique({
    where: { id },
    include: { karigarProfile: true },
  });
  if (!party) {
    throw new AppError("Party not found", 404, "NOT_FOUND");
  }
  return party;
}

export async function create(input: PartyCreateInput) {
  await assertNameTypeUnique(input.name, input.type);
  const partyNumber = await nextPartyNumber(input.type);
  return prisma.party.create({
    data: {
      ...input,
      partyNumber,
    },
  });
}

export async function update(id: string, input: PartyUpdateInput) {
  const existing = await getById(id);
  const name = input.name ?? existing.name;
  const type = input.type ?? existing.type;
  if (input.name !== undefined || input.type !== undefined) {
    await assertNameTypeUnique(name, type, id);
  }
  return prisma.party.update({
    where: { id },
    data: input,
  });
}

export async function updateStatus(id: string, input: PartyStatusInput) {
  await getById(id);
  return prisma.party.update({
    where: { id },
    data: { isActive: input.isActive },
  });
}
