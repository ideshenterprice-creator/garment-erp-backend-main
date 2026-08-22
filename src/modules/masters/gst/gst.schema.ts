import { z } from "zod";

export const gstCreateSchema = z.object({
  category: z.string().min(1),
  gstPercent: z.coerce.number().min(0).max(100),
  taxType: z.enum(["ZERO_RATED", "IGST", "CGST_SGST"]),
  applicableOn: z.string().min(1),
  notes: z.string().optional(),
});

export const gstUpdateSchema = gstCreateSchema.partial();

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type GstCreateInput = z.infer<typeof gstCreateSchema>;
export type GstUpdateInput = z.infer<typeof gstUpdateSchema>;
