import { z } from "zod";

export const partyCreateSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(["BUYER", "SUPPLIER", "KARIGAR"]),
  contact: z.string().optional(),
  gstNumber: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  bankAccount: z.string().optional(),
  ifsc: z.string().optional(),
  bankName: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const partyUpdateSchema = partyCreateSchema.partial();

export const partyStatusSchema = z.object({
  isActive: z.boolean(),
});

export const partyListQuerySchema = z.object({
  type: z.enum(["BUYER", "SUPPLIER", "KARIGAR"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

export const idParamsSchema = z.object({
  id: z.string().uuid(),
});

export type PartyCreateInput = z.infer<typeof partyCreateSchema>;
export type PartyUpdateInput = z.infer<typeof partyUpdateSchema>;
export type PartyStatusInput = z.infer<typeof partyStatusSchema>;
export type PartyListQuery = z.infer<typeof partyListQuerySchema>;
