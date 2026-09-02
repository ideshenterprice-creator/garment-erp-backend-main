import { z } from "zod";

const sizeEnum = z.enum([
  "SIZE_0_3M",
  "SIZE_3_6M",
  "SIZE_6_9M",
  "SIZE_9_12M",
  "SIZE_12_18M",
  "SIZE_18_24M",
]);

export const productCreateSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "ACCESSORY", "WASTAGE"]),
  unit: z.enum(["KG", "PCS", "METERS", "ROLLS"]),
  gstRate: z.coerce.number().min(0).max(100),
  description: z.string().optional(),
  sizes: z.array(sizeEnum).optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export const productStatusSchema = z.object({
  isActive: z.boolean(),
});

export const productListQuerySchema = z.object({
  category: z.enum(["RAW_MATERIAL", "FINISHED_GOOD", "ACCESSORY", "WASTAGE"]).optional(),
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

const imageMimeSchema = z
  .enum(["image/jpeg", "image/jpg", "image/png", "image/webp"])
  .transform((value) => (value === "image/jpg" ? "image/jpeg" : value));

export const productImageUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: imageMimeSchema,
  sizeBytes: z.coerce.number().int().positive().max(5 * 1024 * 1024),
});

export const productImageConfirmSchema = z.object({
  objectPath: z.string().min(8).max(500),
  originalName: z.string().min(1).max(200),
  mimeType: imageMimeSchema,
  sizeBytes: z.coerce.number().int().positive().max(5 * 1024 * 1024),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductStatusInput = z.infer<typeof productStatusSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type ProductImageUploadUrlInput = z.infer<typeof productImageUploadUrlSchema>;
export type ProductImageConfirmInput = z.infer<typeof productImageConfirmSchema>;
