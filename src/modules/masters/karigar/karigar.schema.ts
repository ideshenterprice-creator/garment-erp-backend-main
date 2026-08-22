import { z } from "zod";

const paymentTypeEnum = z.enum(["PIECE_RATE", "WEEKLY_SALARY", "BOTH"]);

function refinePaymentRules(
  data: {
    paymentType?: "PIECE_RATE" | "WEEKLY_SALARY" | "BOTH";
    weeklySalary?: number;
    operationIds?: string[];
  },
  ctx: z.RefinementCtx
): void {
  if (!data.paymentType) {
    return;
  }
  if (
    (data.paymentType === "WEEKLY_SALARY" || data.paymentType === "BOTH") &&
    (data.weeklySalary === undefined || data.weeklySalary <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weeklySalary"],
      message: "weeklySalary is required and must be greater than 0",
    });
  }
  if (
    (data.paymentType === "PIECE_RATE" || data.paymentType === "BOTH") &&
    (!data.operationIds || data.operationIds.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["operationIds"],
      message: "operationIds is required for piece-rate payment types",
    });
  }
}

export const karigarCreateSchema = z
  .object({
    partyId: z.string().uuid(),
    paymentType: paymentTypeEnum,
    weeklySalary: z.coerce.number().optional(),
    operationIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine(refinePaymentRules);

export const karigarUpdateSchema = z
  .object({
    partyId: z.string().uuid().optional(),
    paymentType: paymentTypeEnum.optional(),
    weeklySalary: z.coerce.number().optional(),
    operationIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine(refinePaymentRules);

export const karigarStatusSchema = z.object({
  isActive: z.boolean(),
});

export const karigarListQuerySchema = z.object({
  paymentType: paymentTypeEnum.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const karigarPaymentsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type KarigarCreateInput = z.infer<typeof karigarCreateSchema>;
export type KarigarUpdateInput = z.infer<typeof karigarUpdateSchema>;
export type KarigarStatusInput = z.infer<typeof karigarStatusSchema>;
export type KarigarListQuery = z.infer<typeof karigarListQuerySchema>;
export type KarigarPaymentsQuery = z.infer<typeof karigarPaymentsQuerySchema>;
