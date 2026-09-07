import { AuditAction, Prisma } from "@prisma/client";
import prisma from "@/config/database";

type TxClient = typeof prisma | Prisma.TransactionClient;

export async function createAuditLog(
  params: {
    userId?: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
  },
  tx: TxClient = prisma
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      oldValue: params.oldValue as Prisma.InputJsonValue | undefined,
      newValue: params.newValue as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress,
    },
  });
}
