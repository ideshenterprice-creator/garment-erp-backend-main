import { z } from "zod";

export const issueCreateSchema = z.object({
  issueDate: z.coerce.date(),
  issueType: z.enum(["CUTTING", "PRINTING", "STITCHING", "FINISHING", "SAMPLE", "PATTERN"]),
  productId: z.string().uuid(),
  poId: z.string().uuid(),
  poItemId: z.string().uuid(),
  karigarId: z.string().uuid(),
  quantityIssued: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export const issueReturnSchema = z.object({
  quantityReturned: z.coerce.number().positive(),
  notes: z.string().optional(),
});

export const issueListQuerySchema = z.object({
  issueType: z.enum(["CUTTING", "PRINTING", "STITCHING", "FINISHING", "SAMPLE", "PATTERN"]).optional(),
  karigarId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
  status: z.enum(["ISSUED", "RETURNED", "PARTIAL"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueReturnInput = z.infer<typeof issueReturnSchema>;
export type IssueListQuery = z.infer<typeof issueListQuerySchema>;
