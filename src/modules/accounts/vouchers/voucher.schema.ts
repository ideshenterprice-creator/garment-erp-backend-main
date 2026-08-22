import { z } from "zod";

export const voucherCreateSchema = z.object({
  type: z.enum(["PAYMENT", "RECEIPT"]),
  partyDescription: z.string().min(1),
  amount: z.coerce.number().positive(),
  paymentMode: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]),
  referenceNo: z.string().optional(),
  date: z.coerce.date(),
  notes: z.string().optional(),
});

export const voucherListQuerySchema = z.object({
  type: z.enum(["PAYMENT", "RECEIPT"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type VoucherCreateInput = z.infer<typeof voucherCreateSchema>;
export type VoucherListQuery = z.infer<typeof voucherListQuerySchema>;
