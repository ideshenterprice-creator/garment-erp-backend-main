import { createClient, SupabaseClient } from "@supabase/supabase-js";
import path from "path";
import WebSocket from "ws";
import { AppError } from "@/middleware/errorHandler";
import logger from "@/config/logger";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 15;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

let client: SupabaseClient | null = null;

function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "erp-documents";
}

function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new AppError(
      "File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503,
      "STORAGE_NOT_CONFIGURED"
    );
  }
  if (!client) {
    client = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node < 22 has no global WebSocket; supabase-js realtime requires one at construct time.
      realtime: { transport: WebSocket as never },
    });
  }
  return client;
}

export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, "_");
  const cleaned = base.replace(/^\.+/, "").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

function assertSafeObjectPath(objectPath: string): void {
  if (objectPath.includes("..") || objectPath.startsWith("/") || objectPath.includes("\\")) {
    throw new AppError("Invalid storage path", 400, "INVALID_PATH");
  }
}

export function validateUpload(input: {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): void {
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_FILE_BYTES) {
    throw new AppError("File exceeds the 10MB size limit", 400, "INVALID_FILE");
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw new AppError("Unsupported file type", 400, "INVALID_FILE");
  }
  const ext = path.extname(input.originalName).toLowerCase();
  const allowedExt = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".csv", ".xlsx", ".xls"]);
  if (!allowedExt.has(ext)) {
    throw new AppError("Unsupported file extension", 400, "INVALID_FILE");
  }
}

export async function uploadPrivateObject(input: {
  objectPath: string;
  body: Buffer;
  mimeType: string;
}): Promise<{ bucket: string; objectPath: string }> {
  assertSafeObjectPath(input.objectPath);
  const bucket = storageBucket();
  const { error } = await getClient().storage.from(bucket).upload(input.objectPath, input.body, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) {
    logger.error("Supabase storage upload failed", { message: error.message, bucket });
    throw new AppError("Failed to store file", 502, "STORAGE_UPLOAD_FAILED");
  }
  return { bucket, objectPath: input.objectPath };
}

export async function createSignedUrl(objectPath: string, expiresIn = SIGNED_URL_TTL_SECONDS): Promise<string> {
  assertSafeObjectPath(objectPath);
  const bucket = storageBucket();
  const { data, error } = await getClient().storage.from(bucket).createSignedUrl(objectPath, expiresIn);
  if (error || !data?.signedUrl) {
    logger.error("Supabase signed URL failed", { message: error?.message, bucket });
    throw new AppError("Failed to create file access URL", 502, "STORAGE_URL_FAILED");
  }
  return data.signedUrl;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function pingStorage(): Promise<{ bucket: string; ok: boolean }> {
  const bucket = storageBucket();
  const { data, error } = await getClient().storage.listBuckets();
  if (error) {
    logger.error("Supabase storage ping failed", { message: error.message });
    return { bucket, ok: false };
  }
  return { bucket, ok: (data ?? []).some((item) => item.name === bucket) };
}

export async function ensurePrivateBucket(): Promise<void> {
  if (!isStorageConfigured()) return;
  const bucket = storageBucket();
  const { data, error } = await getClient().storage.listBuckets();
  if (error) {
    logger.error("Unable to list storage buckets", { message: error.message });
    return;
  }
  if ((data ?? []).some((item) => item.name === bucket)) return;

  const { error: createError } = await getClient().storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: MAX_FILE_BYTES,
  });
  if (createError) {
    logger.error("Unable to create private storage bucket", {
      message: createError.message,
      bucket,
    });
    return;
  }
  logger.info("Created private Supabase storage bucket", { bucket });
}
