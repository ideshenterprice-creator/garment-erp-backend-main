import { PrismaClient } from "@prisma/client";
import { KarigarPaymentCalc } from "@/types";
import { AppError } from "@/middleware/errorHandler";

export async function calculateKarigarPayment(
  operationId: string,
  pieces: number,
  prisma: PrismaClient
): Promise<KarigarPaymentCalc> {
  const operation = await prisma.operation.findUnique({ where: { id: operationId } });
  if (!operation || !operation.isActive) {
    throw new AppError("Operation master not found or inactive", 404, "OPERATION_NOT_FOUND");
  }

  const rate = Number(operation.ratePerPiece);
  const amountDue = Number((rate * pieces).toFixed(2));

  return { rate, pieces, amountDue };
}
