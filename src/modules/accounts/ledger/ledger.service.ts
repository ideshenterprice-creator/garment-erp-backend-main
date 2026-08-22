import prisma from "@/config/database";

export async function list(partyId?: string) {
  return prisma.ledgerEntry.findMany({
    where: partyId ? { partyId } : undefined,
    include: { party: true },
    orderBy: { entryDate: "asc" },
  });
}

export async function getByParty(partyId: string) {
  return prisma.ledgerEntry.findMany({
    where: { partyId },
    include: { party: true },
    orderBy: { createdAt: "asc" },
  });
}
