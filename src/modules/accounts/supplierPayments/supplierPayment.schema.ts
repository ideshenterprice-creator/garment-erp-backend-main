import { z } from "zod";

export const paymentModeSchema = z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]);

export const supplierPaymentCreateSchema = z.object({
  purchaseBillId: z.string().uuid(),
  amountPaid: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  paymentMode: paymentModeSchema,
  referenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export const supplierPaymentListQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
  status: z.enum(["PAID", "PARTIAL", "UNPAID"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type SupplierPaymentCreateInput = z.infer<typeof supplierPaymentCreateSchema>;
export type SupplierPaymentListQuery = z.infer<typeof supplierPaymentListQuerySchema>;
export type BillPayStatus = "PAID" | "PARTIAL" | "UNPAID";
