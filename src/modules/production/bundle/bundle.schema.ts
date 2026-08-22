import { z } from "zod";

export const bundleListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  currentStage: z
    .enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING", "BOXING", "COMPLETED"])
    .optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const bundleNumberParamsSchema = z.object({
  bundleNumber: z.string().min(1),
});

export type BundleListQuery = z.infer<typeof bundleListQuerySchema>;
