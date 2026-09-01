import { PartyType, Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { PartyCreateInput, PartyListQuery, PartyStatusInput, PartyUpdateInput } from "./party.schema";
import { notifyActiveUsers, NotificationType } from "@/modules/notifications/notification.service";

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
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { partyNumber: { contains: term, mode: "insensitive" } },
      { gstNumber: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { contact: { contains: term, mode: "insensitive" } },
    ];
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
  const created = await prisma.party.create({
    data: {
      ...input,
      partyNumber,
    },
  });
  void notifyActiveUsers({
    type: NotificationType.PARTY_CREATED,
    title: "Party created",
    message: `${created.name} (${created.partyNumber}) was added.`,
    metadata: { entityType: "PARTY", entityId: created.id },
    dedupeKey: `PARTY:${created.id}`,
  });
  return created;
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

async function assertPartyCanBeDeleted(id: string): Promise<void> {
  const [
    buyerOrders,
    supplierBills,
    issuesAsKarigar,
    wastageReturns,
    cuttingEntries,
    printingEntries,
    coloringEntries,
    stitchingEntries,
    finishingEntries,
    karigarPayments,
    buyerContainers,
    buyerSalesBills,
    creditDebitNotes,
    supplierPayments,
  ] = await Promise.all([
    prisma.purchaseOrder.count({ where: { buyerId: id } }),
    prisma.purchaseBill.count({ where: { supplierId: id } }),
    prisma.issueRecord.count({ where: { karigarId: id } }),
    prisma.cuttingWastage.count({ where: { returnedById: id } }),
    prisma.cuttingEntry.count({ where: { karigarId: id } }),
    prisma.printingEntry.count({ where: { karigarId: id } }),
    prisma.coloringEntry.count({ where: { karigarId: id } }),
    prisma.stitchingEntry.count({ where: { karigarId: id } }),
    prisma.finishingEntry.count({ where: { karigarId: id } }),
    prisma.karigarPayment.count({ where: { karigarId: id } }),
    prisma.container.count({ where: { buyerId: id } }),
    prisma.salesBill.count({ where: { buyerId: id } }),
    prisma.creditDebitNote.count({ where: { buyerId: id } }),
    prisma.supplierPayment.count({ where: { supplierId: id } }),
  ]);

  const blockers: string[] = [];
  if (buyerOrders > 0) blockers.push(`${buyerOrders} purchase order(s)`);
  if (supplierBills > 0) blockers.push(`${supplierBills} purchase bill(s)`);
  if (issuesAsKarigar > 0) blockers.push(`${issuesAsKarigar} issue record(s)`);
  if (wastageReturns > 0) blockers.push(`${wastageReturns} wastage return(s)`);
  if (cuttingEntries > 0) blockers.push(`${cuttingEntries} cutting entry(ies)`);
  if (printingEntries > 0) blockers.push(`${printingEntries} printing entry(ies)`);
  if (coloringEntries > 0) blockers.push(`${coloringEntries} coloring entry(ies)`);
  if (stitchingEntries > 0) blockers.push(`${stitchingEntries} stitching entry(ies)`);
  if (finishingEntries > 0) blockers.push(`${finishingEntries} finishing entry(ies)`);
  if (karigarPayments > 0) blockers.push(`${karigarPayments} karigar payment(s)`);
  if (buyerContainers > 0) blockers.push(`${buyerContainers} container(s)`);
  if (buyerSalesBills > 0) blockers.push(`${buyerSalesBills} sales bill(s)`);
  if (creditDebitNotes > 0) blockers.push(`${creditDebitNotes} credit/debit note(s)`);
  if (supplierPayments > 0) blockers.push(`${supplierPayments} supplier payment(s)`);

  if (blockers.length > 0) {
    throw new AppError(
      `Cannot delete party linked to ${blockers.join(", ")}. Remove or reassign those records first.`,
      409,
      "PARTY_IN_USE"
    );
  }
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  const party = await getById(id);
  await assertPartyCanBeDeleted(id);

  await prisma.$transaction(async (tx) => {
    if (party.karigarProfile) {
      await tx.karigarProfile.delete({ where: { id: party.karigarProfile.id } });
    }
    await tx.ledgerEntry.deleteMany({ where: { partyId: id } });
    await tx.party.delete({ where: { id } });
  });

  return { id, message: "Party deleted permanently" };
}
