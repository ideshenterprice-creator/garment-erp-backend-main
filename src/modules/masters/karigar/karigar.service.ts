import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import {
  KarigarCreateInput,
  KarigarListQuery,
  KarigarPaymentsQuery,
  KarigarStatusInput,
  KarigarUpdateInput,
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
  operations: {
    include: {
      operation: {
        select: {
          id: true,
          operationCode: true,
          name: true,
          stage: true,
          ratePerPiece: true,
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

export async function list(query: KarigarListQuery) {
  const where: Prisma.KarigarProfileWhereInput = {};
  if (query.paymentType) where.paymentType = query.paymentType;
  if (query.isActive !== undefined) where.isActive = query.isActive;

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

export async function create(input: KarigarCreateInput) {
  await assertKarigarParty(input.partyId);
  if (input.operationIds?.length) {
    await assertOperationsExist(input.operationIds);
  }

  const profile = await prisma.$transaction(async (tx) => {
    const created = await tx.karigarProfile.create({
      data: {
        partyId: input.partyId,
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

    return tx.karigarProfile.findUniqueOrThrow({
      where: { id: created.id },
      include: profileInclude,
    });
  });

  return mapProfile(profile);
}

export async function update(id: string, input: KarigarUpdateInput) {
  const existing = await prisma.karigarProfile.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Karigar profile not found", 404, "NOT_FOUND");
  }

  if (input.partyId) {
    await assertKarigarParty(input.partyId);
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

    return tx.karigarProfile.update({
      where: { id },
      data: {
        partyId: input.partyId,
        paymentType: input.paymentType,
        weeklySalary: input.weeklySalary,
      },
      include: profileInclude,
    });
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
