import { z } from "zod";

export const stockListQuerySchema = z.object({
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "ACCESSORY", "WASTAGE"]).optional(),
  lowStock: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockHistoryQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  transactionType: z
    .enum(["PURCHASE_IN", "ISSUE_OUT", "PRODUCTION_IN", "ADJUSTMENT", "WASTAGE_IN", "SALE_OUT"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockAdjustSchema = z.object({
  adjustmentType: z.enum(["ADD", "REDUCE"]),
  quantity: z.coerce.number().positive(),
  reason: z.enum(["PHYSICAL_COUNT_CORRECTION", "DAMAGED", "SAMPLE_USED", "OTHER"]),
  notes: z.string().optional(),
  date: z.coerce.date().optional(),
});

export const productIdParamsSchema = z.object({
  productId: z.string().uuid(),
});

export type StockListQuery = z.infer<typeof stockListQuerySchema>;
export type StockHistoryQuery = z.infer<typeof stockHistoryQuerySchema>;
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
