import { z } from "zod";

export const operationCreateSchema = z.object({
  name: z.string().min(1).max(200),
  stage: z.enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING"]),
  ratePerPiece: z.coerce.number().min(0),
  unit: z.string().default("per piece"),
});

export const operationUpdateSchema = operationCreateSchema.partial();

export const operationStatusSchema = z.object({
  isActive: z.boolean(),
});

export const operationListQuerySchema = z.object({
  stage: z.enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type OperationCreateInput = z.infer<typeof operationCreateSchema>;
export type OperationUpdateInput = z.infer<typeof operationUpdateSchema>;
export type OperationStatusInput = z.infer<typeof operationStatusSchema>;
export type OperationListQuery = z.infer<typeof operationListQuerySchema>;
