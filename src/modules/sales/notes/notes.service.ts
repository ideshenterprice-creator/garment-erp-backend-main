import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { createLedgerEntry } from "@/utils/ledgerHelper";
import { NoteCreateInput, NotesListQuery } from "./notes.schema";

const include = {
  salesBill: {
    select: { id: true, invoiceNumber: true, netTotal: true, status: true, buyerId: true },
  },
  buyer: { select: { id: true, name: true, type: true } },
} as const;

async function nextNoteNumber(type: "CREDIT" | "DEBIT"): Promise<string> {
  const prefix = type === "CREDIT" ? "CN-" : "DN-";
  const count = await prisma.creditDebitNote.count({
    where: { noteNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function list(query: NotesListQuery) {
  const where: Prisma.CreditDebitNoteWhereInput = {};
  if (query.type) where.type = query.type;
  if (query.buyerId) where.buyerId = query.buyerId;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = query.from;
    if (query.to) where.date.lte = query.to;
  }

  const [data, total] = await prisma.$transaction([
    prisma.creditDebitNote.findMany({
      where,
      include,
      orderBy: { date: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.creditDebitNote.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const note = await prisma.creditDebitNote.findUnique({ where: { id }, include });
  if (!note) throw new AppError("Note not found", 404, "NOT_FOUND");
  return note;
}

export async function create(input: NoteCreateInput) {
  const salesBill = await prisma.salesBill.findUnique({ where: { id: input.salesBillId } });
  if (!salesBill) throw new AppError("Sales bill not found", 404, "NOT_FOUND");
  if (salesBill.status !== "SUBMITTED" && salesBill.status !== "PAID") {
    throw new AppError("Notes can only be raised on submitted or paid bills", 400, "INVALID_STATUS");
  }

  const noteNumber = await nextNoteNumber(input.type);

  return prisma.$transaction(async (tx) => {
    const note = await tx.creditDebitNote.create({
      data: {
        noteNumber,
        type: input.type,
        salesBillId: input.salesBillId,
        buyerId: salesBill.buyerId,
        amount: input.amount,
        reason: input.reason,
        date: input.date,
      },
      include,
    });

    await createLedgerEntry(
      {
        partyId: salesBill.buyerId,
        description: `${input.type} note ${noteNumber} — ${input.reason}`,
        referenceType: "CREDIT_DEBIT_NOTE",
        referenceId: note.id,
        debitAmount: input.type === "DEBIT" ? input.amount : 0,
        creditAmount: input.type === "CREDIT" ? input.amount : 0,
      },
      tx
    );

    return note;
  });
}
