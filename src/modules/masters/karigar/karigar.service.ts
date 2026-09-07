import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import * as partyService from "@/modules/masters/party/party.service";
import { createAuditLog } from "@/utils/auditHelper";
import { isoWeek } from "@/modules/production/shared";
import {
  KarigarCreateInput,
  KarigarListQuery,
  KarigarPaymentsQuery,
  KarigarStatusInput,
  KarigarUpdateInput,
  KarigarWeeklyStatementsQuery,
} from "./karigar.schema";

const profileInclude = {
  party: {
    select: {
      id: true,
      partyNumber: true,
      name: true,
      contact: true,
      type: true,
      city: true,
    },
  },
  designation: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  operations: {
    include: {
      operation: {
        select: {
          id: true,
          operationCode: true,
          name: true,
          stage: true,
          ratePerPiece: true,
          lotNo: true,
          department: true,
          departmentType: true,
        },
      },
    },
  },
} as const;

function mapProfile<T extends { operations: Array<{ operation: unknown }> }>(profile: T) {
  return {
    ...profile,
    operations: profile.operations.map((item) => item.operation),
  };
}

async function assertKarigarParty(partyId: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) {
    throw new AppError("Party not found", 404, "NOT_FOUND");
  }
  if (party.type !== "KARIGAR") {
    throw new AppError("Party must be of type KARIGAR", 400, "INVALID_PARTY_TYPE");
  }
}

async function assertOperationsExist(operationIds: string[]): Promise<void> {
  const operations = await prisma.operation.findMany({
    where: { id: { in: operationIds } },
    select: { id: true },
  });
  if (operations.length !== operationIds.length) {
    throw new AppError("One or more operations were not found", 400, "INVALID_OPERATION");
  }
}

async function assertDesignationExists(designationId: string): Promise<void> {
  const designation = await prisma.designation.findUnique({ where: { id: designationId } });
  if (!designation || !designation.isActive) {
    throw new AppError("Designation not found or inactive", 400, "INVALID_DESIGNATION");
  }
}

export async function list(query: KarigarListQuery) {
  const where: Prisma.KarigarProfileWhereInput = {};
  if (query.paymentType) where.paymentType = query.paymentType;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.designationId) where.designationId = query.designationId;
  if (query.search) {
    where.party = {
      name: { contains: query.search, mode: "insensitive" },
    };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.karigarProfile.findMany({
      where,
      include: profileInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.karigarProfile.count({ where }),
  ]);

  return {
    data: rows.map(mapProfile),
    total,
    page: query.page,
    limit: query.limit,
  };
}

export async function getById(id: string) {
  const profile = await prisma.karigarProfile.findUnique({
    where: { id },
    include: profileInclude,
  });
  if (!profile) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }
  return mapProfile(profile);
}

export async function create(input: KarigarCreateInput, userId?: string) {
  await assertKarigarParty(input.partyId);
  if (input.designationId) {
    await assertDesignationExists(input.designationId);
  }
  if (input.operationIds?.length) {
    await assertOperationsExist(input.operationIds);
  }

  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.karigarProfile.create({
      data: {
        partyId: input.partyId,
        designationId: input.designationId,
        paymentType: input.paymentType,
        weeklySalary: input.weeklySalary,
      },
    });

    if (input.operationIds?.length) {
      await tx.karigarOperation.createMany({
        data: input.operationIds.map((operationId) => ({
          karigarProfileId: created.id,
          operationId,
        })),
      });
    }

    await createAuditLog(
      {
        userId,
        action: "CREATE",
        entity: "KarigarProfile",
        entityId: created.id,
        newValue: input,
      },
      tx
    );

    return tx.karigarProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: profileInclude,
    });
  });

  return mapProfile(profile);
}

export async function update(id: string, input: KarigarUpdateInput, userId?: string) {
  const existing = await prisma.karigarProfile.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }

  if (input.partyId) {
    await assertKarigarParty(input.partyId);
  }
  if (input.designationId) {
    await assertDesignationExists(input.designationId);
  }
  if (input.operationIds?.length) {
    await assertOperationsExist(input.operationIds);
  }

  const profile = await prisma.$transaction(async (tx) => {
    if (input.operationIds) {
      await tx.karigarOperation.deleteMany({ where: { karigarProfileId: id } });
      if (input.operationIds.length) {
        await tx.karigarOperation.createMany({
          data: input.operationIds.map((operationId) => ({
            karigarProfileId: id,
            operationId,
          })),
        });
      }
    }

    const updated = await tx.karigarProfile.update({
      where: { id },
      data: {
        partyId: input.partyId,
        designationId: input.designationId,
        paymentType: input.paymentType,
        weeklySalary: input.weeklySalary,
      },
      include: profileInclude,
    });

    await createAuditLog(
      {
        userId,
        action: "UPDATE",
        entity: "KarigarProfile",
        entityId: id,
        oldValue: existing,
        newValue: input,
      },
      tx
    );

    return updated;
  });

  return mapProfile(profile);
}

export async function updateStatus(id: string, input: KarigarStatusInput) {
  await getById(id);
  const profile = await prisma.karigarProfile.update({
    where: { id },
    data: { isActive: input.isActive },
    include: profileInclude,
  });
  return mapProfile(profile);
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  const profile = await getById(id);
  await partyService.remove(profile.partyId);
  return { id, message: "Karigar deleted permanently" };
}

export async function listPayments(id: string, query: KarigarPaymentsQuery) {
  const profile = await prisma.karigarProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }

  const where: Prisma.KarigarPaymentWhereInput = {
    karigarId: profile.partyId,
  };
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  const [data, total] = await prisma.$transaction([
    prisma.karigarPayment.findMany({
      where,
      include: {
        operation: {
          select: { id: true, name: true, stage: true, ratePerPiece: true },
        },
        po: { select: { id: true, poNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.karigarPayment.count({ where }),
  ]);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getStats() {
  const { week, year } = isoWeek(new Date());

  const [
    totalKarigars,
    pieceRateCount,
    weeklySalaryCount,
    bothCount,
    activeKarigars,
    pendingPayments,
    thisWeekPieces,
    thisWeekAmount,
    paidThisWeek,
  ] = await prisma.$transaction([
    prisma.karigarProfile.count(),
    prisma.karigarProfile.count({ where: { paymentType: "PIECE_RATE" } }),
    prisma.karigarProfile.count({ where: { paymentType: "WEEKLY_SALARY" } }),
    prisma.karigarProfile.count({ where: { paymentType: "BOTH" } }),
    prisma.karigarProfile.count({ where: { isActive: true } }),
    prisma.karigarPayment.aggregate({
      where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } },
      _sum: { amountDue: true, amountPaid: true },
      _count: true,
    }),
    prisma.karigarPayment.aggregate({
      where: { weekNumber: week, year },
      _sum: { piecesCompleted: true },
    }),
    prisma.karigarPayment.aggregate({
      where: { weekNumber: week, year },
      _sum: { amountDue: true },
    }),
    prisma.karigarPayment.aggregate({
      where: { weekNumber: week, year },
      _sum: { amountPaid: true },
    }),
  ]);

  const grossPending = Number(pendingPayments._sum.amountDue ?? 0);
  const paidPending = Number(pendingPayments._sum.amountPaid ?? 0);

  return {
    totalKarigars,
    activeKarigars,
    pieceRateCount,
    weeklySalaryCount,
    bothCount,
    pendingPaymentAmount: Number((grossPending - paidPending).toFixed(2)),
    pendingPaymentCount: pendingPayments._count,
    thisWeekPieces: thisWeekPieces._sum.piecesCompleted ?? 0,
    thisWeekAmount: Number(thisWeekAmount._sum.amountDue ?? 0),
    paidThisWeek: Number(paidThisWeek._sum.amountPaid ?? 0),
    weekNumber: week,
    year,
  };
}

function weekStartDate(year: number, weekNumber: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (weekNumber - 1) * 7);
  return monday;
}

function weekEndDate(year: number, weekNumber: number): Date {
  const start = weekStartDate(year, weekNumber);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return end;
}

function deriveWeeklyStatus(
  grossAmount: number,
  paidAmount: number
): "PENDING" | "PARTIALLY_PAID" | "PAID" {
  if (paidAmount <= 0) return "PENDING";
  if (paidAmount >= grossAmount) return "PAID";
  return "PARTIALLY_PAID";
}

export async function listWeeklyStatements(id: string, query: KarigarWeeklyStatementsQuery) {
  const profile = await prisma.karigarProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }

  const where: Prisma.KarigarPaymentWhereInput = { karigarId: profile.partyId };
  if (query.year) where.year = query.year;

  const payments = await prisma.karigarPayment.findMany({
    where,
    select: {
      weekNumber: true,
      year: true,
      piecesCompleted: true,
      amountDue: true,
      amountPaid: true,
      status: true,
    },
  });

  const grouped = new Map<
    string,
    {
      weekNumber: number;
      year: number;
      totalPieces: number;
      grossAmount: number;
      paidAmount: number;
    }
  >();

  for (const payment of payments) {
    const key = `${payment.year}-${payment.weekNumber}`;
    const current = grouped.get(key) ?? {
      weekNumber: payment.weekNumber,
      year: payment.year,
      totalPieces: 0,
      grossAmount: 0,
      paidAmount: 0,
    };
    current.totalPieces += payment.piecesCompleted;
    current.grossAmount += Number(payment.amountDue);
    current.paidAmount += Number(payment.amountPaid);
    grouped.set(key, current);
  }

  const statements = Array.from(grouped.values())
    .map((row) => {
      const pendingAmount = Number((row.grossAmount - row.paidAmount).toFixed(2));
      return {
        weekNumber: row.weekNumber,
        year: row.year,
        startDate: weekStartDate(row.year, row.weekNumber),
        endDate: weekEndDate(row.year, row.weekNumber),
        totalPieces: row.totalPieces,
        grossAmount: Number(row.grossAmount.toFixed(2)),
        paidAmount: Number(row.paidAmount.toFixed(2)),
        pendingAmount,
        status: deriveWeeklyStatus(row.grossAmount, row.paidAmount),
      };
    })
    .sort((a, b) => b.year - a.year || b.weekNumber - a.weekNumber);

  const start = (query.page - 1) * query.limit;
  const data = statements.slice(start, start + query.limit);

  return {
    data,
    total: statements.length,
    page: query.page,
    limit: query.limit,
  };
}

export async function getLedger(id: string) {
  const profile = await prisma.karigarProfile.findUnique({
    where: { id },
    include: { party: { select: { id: true, name: true, partyNumber: true } } },
  });
  if (!profile) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }

  const [payments, transactions] = await prisma.$transaction([
    prisma.karigarPayment.findMany({
      where: { karigarId: profile.partyId },
      include: {
        operation: { select: { id: true, name: true, stage: true } },
        po: { select: { id: true, poNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.karigarPaymentTransaction.findMany({
      where: { karigarId: profile.partyId },
      include: {
        karigarPayment: {
          select: {
            paymentNumber: true,
            operation: { select: { name: true } },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  type LedgerRow = {
    date: Date;
    reference: string;
    operation: string | null;
    pieces: number | null;
    rate: number | null;
    debit: number;
    credit: number;
    balance: number;
    type: "EARNING" | "PAYMENT";
  };

  const rows: Omit<LedgerRow, "balance">[] = [];

  for (const payment of payments) {
    rows.push({
      date: payment.createdAt,
      reference: payment.paymentNumber,
      operation: payment.operation.name,
      pieces: payment.piecesCompleted,
      rate: Number(payment.ratePerPiece),
      debit: Number(payment.amountDue),
      credit: 0,
      type: "EARNING",
    });
  }

  for (const txn of transactions) {
    rows.push({
      date: txn.paymentDate,
      reference: txn.referenceNo ?? txn.karigarPayment.paymentNumber,
      operation: txn.karigarPayment.operation?.name ?? null,
      pieces: null,
      rate: null,
      debit: 0,
      credit: Number(txn.amountPaid),
      type: "PAYMENT",
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const ledger: LedgerRow[] = rows.map((row) => {
    balance = Number((balance + row.debit - row.credit).toFixed(2));
    return { ...row, balance };
  });

  return {
    karigar: profile.party,
    entries: ledger,
    closingBalance: balance,
  };
}
