import { z } from "zod";

export const containerCreateSchema = z.object({
  poId: z.string().uuid(),
  destination: z.string().min(1),
  dispatchDate: z.coerce.date().optional(),
});

export const addBoxSchema = z.object({
  boxId: z.string().uuid(),
});

export const dispatchSchema = z.object({
  dispatchDate: z.coerce.date(),
});

export const containerListQuerySchema = z.object({
  poId: z.string().uuid().optional(),
  status: z.enum(["LOADING", "READY", "DISPATCHED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamsSchema = z.object({ id: z.string().uuid() });

export type ContainerCreateInput = z.infer<typeof containerCreateSchema>;
export type AddBoxInput = z.infer<typeof addBoxSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
export type ContainerListQuery = z.infer<typeof containerListQuerySchema>;
