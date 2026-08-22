import { z } from "zod";

export const noteCreateSchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"]),
  salesBillId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
  date: z.coerce.date(),
});

export const notesListQuerySchema = z.object({
  type: z.enum(["CREDIT", "DEBIT"]).optional(),
  buyerId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NotesListQuery = z.infer<typeof notesListQuerySchema>;
