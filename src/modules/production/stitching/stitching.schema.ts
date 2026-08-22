import { z } from "zod";

export const stitchingCreateSchema = z.object({
  entryDate: z.coerce.date(),
  bundleId: z.string().uuid(),
  poId: z.string().uuid(),
  karigarId: z.string().uuid(),
  operationId: z.string().uuid(),
  piecesGiven: z.coerce.number().int().min(0),
  piecesReturned: z.coerce.number().int().min(0),
  piecesRejected: z.coerce.number().int().min(0).default(0),
});

export const stitchingListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  karigarId: z.string().uuid().optional(),
  bundleId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type StitchingCreateInput = z.infer<typeof stitchingCreateSchema>;
export type StitchingListQuery = z.infer<typeof stitchingListQuerySchema>;
