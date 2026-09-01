import { z } from "zod";

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  type: z.string().min(1).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
