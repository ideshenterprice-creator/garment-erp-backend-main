import { Prisma, PrismaClient } from "@prisma/client";
import { LedgerEntryParams } from "@/types";

type TxClient = PrismaClient | Prisma.TransactionClient;

export async function createLedgerEntry(
  params: LedgerEntryParams,
  prisma: TxClient
): Promise<void> {
  const last = await prisma.ledgerEntry.findFirst({
    where: { partyId: params.partyId },
    orderBy: { createdAt: "desc" },
  });

  const previous = last ? Number(last.balance) : 0;
  const balance = previous + params.debitAmount - params.creditAmount;

  await prisma.ledgerEntry.create({
    data: {
      partyId: params.partyId,
      entryDate: new Date(),
      description: params.description,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      debitAmount: params.debitAmount,
      creditAmount: params.creditAmount,
      balance,
    },
  });
}
