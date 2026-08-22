import { z } from "zod";

const qty = z.coerce.number().int().min(0).default(0);

export const boxCreateSchema = z.object({
  poId: z.string().uuid(),
  poItemId: z.string().uuid(),
  designNumber: z.string().min(1),
  color: z.string().min(1),
  qty_0_3M: qty,
  qty_3_6M: qty,
  qty_6_9M: qty,
  qty_9_12M: qty,
  qty_12_18M: qty,
  qty_18_24M: qty,
});

export const boxListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  status: z.enum(["PACKED", "LOADED"]).optional(),
  containerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type BoxCreateInput = z.infer<typeof boxCreateSchema>;
export type BoxListQuery = z.infer<typeof boxListQuerySchema>;
