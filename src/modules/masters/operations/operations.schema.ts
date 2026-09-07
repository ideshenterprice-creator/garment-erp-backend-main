import { z } from "zod";

const operationDepartmentEnum = z.enum([
  "FLATLOCK",
  "OVERLOCK",
  "LOCK_STITCH",
  "IRON",
  "CUTTING_MACHINE",
  "PRINTING_MACHINE",
  "COLORING_MACHINE",
  "OTHER",
]);

const stitchingDepartmentTypes = [
  "FLATLOCK",
  "OVERLOCK",
  "LOCK_STITCH",
  "IRON",
  "OTHER",
] as const;

const operationDepartmentFields = {
  lotNo: z.string().trim().max(50).nullish(),
  department: z.string().nullish(),
  departmentType: operationDepartmentEnum.nullish(),
};

function validateStitchingDepartment(
  data: { stage?: string; departmentType?: string | null },
  ctx: z.RefinementCtx
) {
  if (data.stage === "STITCHING" && data.departmentType) {
    if (!stitchingDepartmentTypes.includes(data.departmentType as (typeof stitchingDepartmentTypes)[number])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `For STITCHING stage, departmentType must be one of: ${stitchingDepartmentTypes.join(", ")}`,
        path: ["departmentType"],
      });
    }
  }
}

export const operationCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    stage: z.enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING"]),
    ratePerPiece: z.coerce.number().min(0),
    unit: z.string().default("per piece"),
    ...operationDepartmentFields,
  })
  .superRefine(validateStitchingDepartment);

export const operationUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    stage: z.enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING"]).optional(),
    ratePerPiece: z.coerce.number().min(0).optional(),
    unit: z.string().optional(),
    ...operationDepartmentFields,
  })
  .superRefine(validateStitchingDepartment);

export const operationStatusSchema = z.object({
  isActive: z.boolean(),
});

export const operationListQuerySchema = z.object({
  stage: z.enum(["CUTTING", "PRINTING", "COLORING", "STITCHING", "FINISHING"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
  department: z.string().optional(),
  departmentType: operationDepartmentEnum.optional(),
  lotNo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type OperationCreateInput = z.infer<typeof operationCreateSchema>;
export type OperationUpdateInput = z.infer<typeof operationUpdateSchema>;
export type OperationStatusInput = z.infer<typeof operationStatusSchema>;
export type OperationListQuery = z.infer<typeof operationListQuerySchema>;
