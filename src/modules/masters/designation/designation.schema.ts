import { z } from "zod";

export const designationCreateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
});

export const designationUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
});

export const designationStatusSchema = z.object({
  isActive: z.boolean(),
});

export const designationListQuerySchema = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type DesignationCreateInput = z.infer<typeof designationCreateSchema>;
export type DesignationUpdateInput = z.infer<typeof designationUpdateSchema>;
export type DesignationStatusInput = z.infer<typeof designationStatusSchema>;
export type DesignationListQuery = z.infer<typeof designationListQuerySchema>;
