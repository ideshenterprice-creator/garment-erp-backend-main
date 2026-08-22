import { z } from "zod";

const qty = z.coerce.number().int().min(0).default(0);

export const cuttingCreateSchema = z.object({
  entryDate: z.coerce.date(),
  bundleId: z.string().uuid(),
  poId: z.string().uuid(),
  poItemId: z.string().uuid(),
  karigarId: z.string().uuid(),
  qty_0_3M: qty,
  qty_3_6M: qty,
  qty_6_9M: qty,
  qty_9_12M: qty,
  qty_12_18M: qty,
  qty_18_24M: qty,
  wastageKg: z.coerce.number().min(0),
});

export const cuttingListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
  bundleId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CuttingCreateInput = z.infer<typeof cuttingCreateSchema>;
export type CuttingListQuery = z.infer<typeof cuttingListQuerySchema>;
