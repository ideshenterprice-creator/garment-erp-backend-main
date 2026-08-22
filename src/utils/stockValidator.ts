import { PrismaClient } from "@prisma/client";
import { StockCheckResult } from "@/types";
import { AppError } from "@/middleware/errorHandler";

export async function validateStock(
  productId: string,
  requiredQty: number,
  prisma: PrismaClient
): Promise<StockCheckResult> {
  const stock = await prisma.stock.findUnique({ where: { productId } });
  const available = stock ? Number(stock.quantity) : 0;
  const sufficient = available >= requiredQty;

  if (!sufficient) {
    throw new AppError(
      `Insufficient stock. Available: ${available}, required: ${requiredQty}`,
      400,
      "INSUFFICIENT_STOCK",
      { productId, available, required: requiredQty }
    );
  }

  return { available, sufficient };
}
