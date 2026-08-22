import { z } from "zod";

const qty = z.coerce.number().int().min(0).default(0);

export const poItemSchema = z.object({
  designNumber: z.string().min(1),
  garmentType: z.string().min(1),
  color: z.string().min(1),
  qty_0_3M: qty,
  qty_3_6M: qty,
  qty_6_9M: qty,
  qty_9_12M: qty,
  qty_12_18M: qty,
  qty_18_24M: qty,
});

export const poCreateSchema = z.object({
  buyerId: z.string().uuid(),
  buyerPoReference: z.string().min(1),
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date(),
  shippingDestination: z.string().min(1),
  paymentTerms: z.string().min(1),
  specialInstructions: z.string().optional(),
  items: z.array(poItemSchema).min(1),
});

export const poUpdateSchema = poCreateSchema.partial().extend({
  items: z.array(poItemSchema).min(1).optional(),
});

export const poCancelSchema = z.object({
  reason: z.string().min(1),
});

export const poListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "IN_PRODUCTION", "READY_TO_SHIP", "COMPLETED", "CANCELLED"]).optional(),
  buyerId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type POCreateInput = z.infer<typeof poCreateSchema>;
export type POUpdateInput = z.infer<typeof poUpdateSchema>;
export type POCancelInput = z.infer<typeof poCancelSchema>;
export type POListQuery = z.infer<typeof poListQuerySchema>;
export type POItemInput = z.infer<typeof poItemSchema>;
