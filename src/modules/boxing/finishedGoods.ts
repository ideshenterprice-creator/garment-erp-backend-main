import { SizeLabel } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";

export const SIZE_QTY_FIELDS = [
  ["qty_0_3M", "SIZE_0_3M", "0-3M"],
  ["qty_3_6M", "SIZE_3_6M", "3-6M"],
  ["qty_6_9M", "SIZE_6_9M", "6-9M"],
  ["qty_9_12M", "SIZE_9_12M", "9-12M"],
  ["qty_12_18M", "SIZE_12_18M", "12-18M"],
  ["qty_18_24M", "SIZE_18_24M", "18-24M"],
] as const;

export type SizeQtyField = (typeof SIZE_QTY_FIELDS)[number][0];

export function parseSizeLabel(size: string): SizeLabel | null {
  const normalized = size.trim().toUpperCase().replace(/-/g, "_").replace(/\s/g, "_");
  const withPrefix = normalized.startsWith("SIZE_") ? normalized : `SIZE_${normalized}`;
  const labels: SizeLabel[] = [
    "SIZE_0_3M",
    "SIZE_3_6M",
    "SIZE_6_9M",
    "SIZE_9_12M",
    "SIZE_12_18M",
    "SIZE_18_24M",
  ];
  return labels.find((label) => label === withPrefix) ?? null;
}

export async function findFinishedGoodForDesignSize(designNumber: string, sizeLabel: SizeLabel) {
  return prisma.product.findFirst({
    where: {
      category: "FINISHED_GOOD",
      isActive: true,
      sizes: { some: { sizeLabel } },
      OR: [
        { name: { contains: designNumber, mode: "insensitive" } },
        { productCode: { contains: designNumber, mode: "insensitive" } },
      ],
    },
    include: { stock: true, sizes: true },
  });
}

export async function stockAvailable(productId: string): Promise<number> {
  const stock = await prisma.stock.findUnique({ where: { productId } });
  return stock ? Number(stock.quantity) : 0;
}

export function throwStockErrors(errors: string[]): void {
  if (errors.length === 0) return;
  throw new AppError(errors.join(" | "), 400, "INSUFFICIENT_STOCK", errors);
}
