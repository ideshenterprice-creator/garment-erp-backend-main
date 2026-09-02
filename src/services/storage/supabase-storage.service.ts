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

export function storageBucket(): string {
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

export async function createSignedUploadUrl(objectPath: string): Promise<{
  signedUrl: string;
  token: string;
  objectPath: string;
}> {
  assertSafeObjectPath(objectPath);
  const bucket = storageBucket();
  const { data, error } = await getClient().storage.from(bucket).createSignedUploadUrl(objectPath);
  if (error || !data?.signedUrl || !data.token) {
    logger.error("Supabase signed upload URL failed", { message: error?.message, bucket });
    throw new AppError("Failed to create image upload URL", 502, "STORAGE_UPLOAD_FAILED");
  }
  const signedUrl = data.signedUrl.startsWith("http")
    ? data.signedUrl
    : `${(process.env.SUPABASE_URL ?? "").replace(/\/$/, "")}${data.signedUrl.startsWith("/") ? "" : "/"}${data.signedUrl}`;
  return { signedUrl, token: data.token, objectPath: data.path || objectPath };
}

export async function objectExists(objectPath: string): Promise<boolean> {
  assertSafeObjectPath(objectPath);
  const bucket = storageBucket();
  const slash = objectPath.lastIndexOf("/");
  const dir = slash >= 0 ? objectPath.slice(0, slash) : "";
  const name = slash >= 0 ? objectPath.slice(slash + 1) : objectPath;
  const { data, error } = await getClient().storage.from(bucket).list(dir, {
    limit: 100,
    search: name,
  });
  if (error) {
    logger.warn("Supabase object list failed", { message: error.message, objectPath });
    return false;
  }
  return (data ?? []).some((item) => item.name === name);
}

export function imageMimeFromFilename(
  fileName: string
): "image/jpeg" | "image/png" | "image/webp" | null {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return null;
}

export function normalizeImageMime(
  mimeType: string | undefined,
  fileName: string
): "image/jpeg" | "image/png" | "image/webp" | null {
  const cleaned = (mimeType ?? "").toLowerCase() === "image/jpg" ? "image/jpeg" : (mimeType ?? "").toLowerCase();
  if (cleaned === "image/jpeg" || cleaned === "image/png" || cleaned === "image/webp") {
    return cleaned;
  }
  return imageMimeFromFilename(fileName);
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

export async function createSignedUrls(
  objectPaths: string[],
  expiresIn = SIGNED_URL_TTL_SECONDS
): Promise<Map<string, string>> {
  const unique = [...new Set(objectPaths.filter(Boolean))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  unique.forEach(assertSafeObjectPath);
  const bucket = storageBucket();
  const { data, error } = await getClient().storage.from(bucket).createSignedUrls(unique, expiresIn);
  if (error) {
    logger.error("Supabase batch signed URL failed", { message: error.message, bucket });
    throw new AppError("Failed to create file access URL", 502, "STORAGE_URL_FAILED");
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      urls.set(item.path, item.signedUrl);
    }
  }
  return urls;
}

export async function removePrivateObject(objectPath: string): Promise<void> {
  assertSafeObjectPath(objectPath);
  const bucket = storageBucket();
  const { error } = await getClient().storage.from(bucket).remove([objectPath]);
  if (error) {
    logger.warn("Supabase storage delete failed", { message: error.message, bucket, objectPath });
  }
}

export function detectImageMime(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function validateImageUpload(input: { mimeType: string; sizeBytes: number; body: Buffer }): {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
} {
  if (input.sizeBytes <= 0 || input.sizeBytes > 5 * 1024 * 1024) {
    throw new AppError("Image must be 5MB or smaller", 400, "INVALID_FILE");
  }
  const detected = detectImageMime(input.body);
  if (!detected) {
    throw new AppError("Only JPEG, PNG, and WebP images are allowed", 400, "INVALID_FILE");
  }
  return { mimeType: detected };
}

export function extensionForImageMime(mimeType: "image/jpeg" | "image/png" | "image/webp"): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  return ".png";
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
