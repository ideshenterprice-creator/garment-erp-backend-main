import { z } from "zod";

export const purchaseCreateSchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNo: z.string().min(1),
  purchaseDate: z.coerce.date(),
  poId: z.string().uuid(),
  productId: z.string().uuid(),
  vehicleNumber: z.string().optional(),
  grossWeight: z.coerce.number().positive(),
  tareWeight: z.coerce.number().min(0),
  ratePerKg: z.coerce.number().positive(),
});

export const purchaseReturnSchema = z.object({
  reason: z.string().min(1),
});

export const purchaseListQuerySchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "RETURNED"]).optional(),
  supplierId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const purchaseRegisterQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  supplierId: z.string().uuid().optional(),
  fabricType: z.string().uuid().optional(),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
export type PurchaseListQuery = z.infer<typeof purchaseListQuerySchema>;
export type PurchaseRegisterQuery = z.infer<typeof purchaseRegisterQuerySchema>;
