import { z } from "zod";

export const printingCreateSchema = z.object({
  entryDate: z.coerce.date(),
  bundleId: z.string().uuid(),
  poId: z.string().uuid(),
  karigarId: z.string().uuid(),
  piecesReturned: z.coerce.number().int().min(0),
  piecesRejected: z.coerce.number().int().min(0).default(0),
});

export const printingListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
  bundleId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type PrintingCreateInput = z.infer<typeof printingCreateSchema>;
export type PrintingListQuery = z.infer<typeof printingListQuerySchema>;
