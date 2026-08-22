import { z } from "zod";

const paymentMode = z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]);

export const salesItemSchema = z.object({
  poItemId: z.string().uuid(),
  designNumber: z.string().min(1),
  garmentType: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  ratePerPiece: z.coerce.number().positive(),
});

export const salesCreateSchema = z.object({
  poId: z.string().uuid(),
  containerId: z.string().uuid().optional(),
  invoiceDate: z.coerce.date(),
  currency: z.string().min(1).default("INR"),
  exchangeRate: z.coerce.number().positive().default(1),
  items: z.array(salesItemSchema).min(1),
});

export const salesPaymentSchema = z.object({
  amountReceived: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  paymentMode: z.string().min(1),
  referenceNo: z.string().optional(),
});

export const salesReturnSchema = z.object({
  reason: z.string().min(1),
});

export const salesListQuerySchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "PAID", "RETURNED"]).optional(),
  buyerId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const salesRegisterQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  buyerId: z.string().uuid().optional(),
  poId: z.string().uuid().optional(),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export { paymentMode };

export type SalesCreateInput = z.infer<typeof salesCreateSchema>;
export type SalesPaymentInput = z.infer<typeof salesPaymentSchema>;
export type SalesReturnInput = z.infer<typeof salesReturnSchema>;
export type SalesListQuery = z.infer<typeof salesListQuerySchema>;
export type SalesRegisterQuery = z.infer<typeof salesRegisterQuerySchema>;
