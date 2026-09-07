import { z } from "zod";

export const paymentModeSchema = z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE"]);

export const karigarConfirmSchema = z
  .object({
    paymentDate: z.coerce.date(),
    paymentMode: paymentModeSchema,
    referenceNo: z.string().optional(),
    notes: z.string().optional(),
    amountPaid: z.coerce.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.amountPaid !== undefined && !Number.isFinite(data.amountPaid)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountPaid"],
        message: "amountPaid must be a valid number",
      });
    }
  });

export const karigarListQuerySchema = z.object({
  karigarId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "PARTIALLY_PAID", "PAID"]).optional(),
  weekNumber: z.coerce.number().int().min(1).max(53).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  poId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type KarigarConfirmInput = z.infer<typeof karigarConfirmSchema>;
export type KarigarListQuery = z.infer<typeof karigarListQuerySchema>;
