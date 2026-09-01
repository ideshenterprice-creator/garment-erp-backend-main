import { z } from "zod";

export const attachmentListQuerySchema = z.object({
  entityType: z.string().min(1).max(80),
  entityId: z.string().uuid(),
});

export const attachmentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type AttachmentListQuery = z.infer<typeof attachmentListQuerySchema>;
