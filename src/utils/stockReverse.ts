import { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export async function reverseStockByReference(
  tx: Tx,
  referenceType: string | string[],
  referenceId: string
): Promise<void> {
  const types = Array.isArray(referenceType) ? referenceType : [referenceType];
  const rows = await tx.stockTransaction.findMany({
    where: { referenceType: { in: types }, referenceId },
  });
  for (const row of rows) {
    await tx.stock.update({
      where: { productId: row.productId },
      data: { quantity: { increment: -Number(row.quantity) } },
    });
  }
  await tx.stockTransaction.deleteMany({
    where: { referenceType: { in: types }, referenceId },
  });
}

export async function deleteLedgerByReference(
  tx: Tx,
  referenceType: string | string[],
  referenceId: string
): Promise<void> {
  const types = Array.isArray(referenceType) ? referenceType : [referenceType];
  await tx.ledgerEntry.deleteMany({
    where: { referenceType: { in: types }, referenceId },
  });
}
