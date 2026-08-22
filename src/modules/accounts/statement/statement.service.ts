import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { StatementQuery } from "./statement.schema";

export async function partyStatement(query: StatementQuery) {
  const party = await prisma.party.findUnique({
    where: { id: query.partyId },
    select: { id: true, name: true, type: true },
  });
  if (!party) throw new AppError("Party not found", 404, "NOT_FOUND");

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      partyId: query.partyId,
      entryDate: { gte: query.from, lte: query.to },
    },
    orderBy: { entryDate: "asc" },
  });

  let running = 0;
  const transactions = entries.map((entry) => {
    running += Number(entry.debitAmount) - Number(entry.creditAmount);
    return {
      date: entry.entryDate,
      description: entry.description,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      refNumber: entry.referenceId,
      debit: Number(entry.debitAmount),
      credit: Number(entry.creditAmount),
      balance: Number(running.toFixed(2)),
    };
  });

  const totalBilled = Number(
    entries
      .filter((entry) => entry.referenceType === "SALES_BILL")
      .reduce((sum, entry) => sum + Number(entry.debitAmount), 0)
      .toFixed(2)
  );
  const totalReceived = Number(
    entries
      .filter((entry) => entry.referenceType === "SALES_PAYMENT" || entry.referenceType === "RECEIPT")
      .reduce((sum, entry) => sum + Number(entry.creditAmount), 0)
      .toFixed(2)
  );
  const closingBalance = Number(running.toFixed(2));
  const last = entries[entries.length - 1];

  let balanceType: "RECEIVABLE" | "PAYABLE";
  if (party.type === "BUYER") {
    balanceType = closingBalance >= 0 ? "RECEIVABLE" : "PAYABLE";
  } else {
    balanceType = closingBalance >= 0 ? "PAYABLE" : "RECEIVABLE";
  }

  return {
    party,
    period: { from: query.from, to: query.to },
    summary: {
      totalBilled,
      totalReceived,
      outstanding: closingBalance,
      lastTransactionDate: last?.entryDate ?? null,
    },
    transactions,
    closingBalance,
    balanceType,
  };
}
