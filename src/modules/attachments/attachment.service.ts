import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import * as storage from "@/services/storage/supabase-storage.service";
import { AttachmentListQuery } from "./attachment.schema";

export async function list(query: AttachmentListQuery) {
  const data = await prisma.fileAttachment.findMany({
    where: { entityType: query.entityType, entityId: query.entityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });
  return { data };
}

export async function signedUrl(id: string): Promise<{ url: string; expiresIn: number }> {
  const attachment = await prisma.fileAttachment.findUnique({ where: { id } });
  if (!attachment) {
    throw new AppError("Attachment not found", 404, "NOT_FOUND");
  }
  const url = await storage.createSignedUrl(attachment.objectPath);
  return { url, expiresIn: 15 * 60 };
}
