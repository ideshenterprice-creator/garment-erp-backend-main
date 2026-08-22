import { z } from "zod";

export const wastageCreateSchema = z.object({
  poId: z.string().uuid(),
  designCode: z.string().min(1),
  fabricProductId: z.string().uuid(),
  wastageQty: z.coerce.number().positive(),
  returnedByPartyId: z.string().uuid(),
  dateOfReturn: z.coerce.date(),
  remarks: z.string().optional(),
});

export const wastageListQuerySchema = z.object({
  status: z.enum(["IN_STOCK", "SOLD"]).optional(),
  poId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type WastageCreateInput = z.infer<typeof wastageCreateSchema>;
export type WastageListQuery = z.infer<typeof wastageListQuerySchema>;
