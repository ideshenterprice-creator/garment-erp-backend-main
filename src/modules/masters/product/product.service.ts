import { randomUUID } from "crypto";
import { Prisma, ProductCategory, SizeLabel } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import logger from "@/config/logger";
import * as storage from "@/services/storage/supabase-storage.service";
import {
  ProductCreateInput,
  ProductImageConfirmInput,
  ProductImageUploadUrlInput,
  ProductListQuery,
  ProductStatusInput,
  ProductUpdateInput,
} from "./product.schema";
import { notifyActiveUsers, NotificationType } from "@/modules/notifications/notification.service";

const PRODUCT_IMAGE_ENTITY = "PRODUCT";
const PRODUCT_IMAGE_URL_TTL_SECONDS = 60 * 60 * 24;

const PRODUCT_PREFIX: Record<ProductCategory, string> = {
  RAW_MATERIAL: "RM-",
  FINISHED_GOOD: "FG-",
  ACCESSORY: "ACC-",
  WASTAGE: "WST-",
};

const productInclude = {
  sizes: true,
  stock: true,
} as const;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
type ProductWithoutSizes = Omit<ProductRow, "sizes">;
type ProductDto = (ProductRow | ProductWithoutSizes) & { imageUrl: string | null };

async function nextProductCode(category: ProductCategory): Promise<string> {
  const prefix = PRODUCT_PREFIX[category];
  const count = await prisma.product.count({
    where: { productCode: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

function stripSizesIfNeeded(product: ProductRow): ProductRow | ProductWithoutSizes {
  if (product.category !== "FINISHED_GOOD") {
    const { sizes: _sizes, ...rest } = product;
    return rest;
  }
  return product;
}

async function withImageUrl<T extends { imagePath: string | null }>(product: T): Promise<T & { imageUrl: string | null }> {
  if (!product.imagePath || !storage.isStorageConfigured()) {
    return { ...product, imageUrl: null };
  }
  try {
    const imageUrl = await storage.createSignedUrl(product.imagePath, PRODUCT_IMAGE_URL_TTL_SECONDS);
    return { ...product, imageUrl };
  } catch {
    return { ...product, imageUrl: null };
  }
}

async function withImageUrls<T extends { imagePath: string | null }>(
  products: T[]
): Promise<Array<T & { imageUrl: string | null }>> {
  const paths = products.map((product) => product.imagePath).filter((path): path is string => Boolean(path));
  let urlMap = new Map<string, string>();
  if (paths.length > 0 && storage.isStorageConfigured()) {
    try {
      urlMap = await storage.createSignedUrls(paths, PRODUCT_IMAGE_URL_TTL_SECONDS);
    } catch (error) {
      logger.warn("Failed to sign product image URLs", {
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return products.map((product) => ({
    ...product,
    imageUrl: product.imagePath ? urlMap.get(product.imagePath) ?? null : null,
  }));
}

async function toProductDto(product: ProductRow): Promise<ProductDto> {
  return withImageUrl(stripSizesIfNeeded(product));
}

export async function list(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (query.category) where.category = query.category;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { productCode: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const shaped = rows.map(stripSizesIfNeeded);
  const data = await withImageUrls(shaped);

  return { data, total, page: query.page, limit: query.limit };
}

export async function getById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  return toProductDto(product);
}

export async function create(input: ProductCreateInput) {
  const productCode = await nextProductCode(input.category);
  const sizes =
    input.category === "FINISHED_GOOD" && input.sizes?.length
      ? input.sizes.map((sizeLabel) => ({ sizeLabel: sizeLabel as SizeLabel }))
      : [];

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        productCode,
        name: input.name,
        category: input.category,
        unit: input.unit,
        gstRate: input.gstRate,
        description: input.description,
        sizes: sizes.length ? { create: sizes } : undefined,
      },
      include: productInclude,
    });

    await tx.stock.create({
      data: { productId: product.id, quantity: 0 },
    });

    return tx.product.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude,
    });
  });

  void notifyActiveUsers({
    type: NotificationType.PRODUCT_CREATED,
    title: "Product created",
    message: `${created.name} (${created.productCode}) was added.`,
    metadata: { entityType: "PRODUCT", entityId: created.id },
    dedupeKey: `PRODUCT:${created.id}`,
  });

  return toProductDto(created);
}

export async function update(id: string, input: ProductUpdateInput) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { sizes: true } });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  const category = input.category ?? existing.category;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.sizes && category === "FINISHED_GOOD") {
      await tx.productSize.deleteMany({ where: { productId: id } });
      if (input.sizes.length) {
        await tx.productSize.createMany({
          data: input.sizes.map((sizeLabel) => ({
            productId: id,
            sizeLabel: sizeLabel as SizeLabel,
          })),
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        category: input.category,
        unit: input.unit,
        gstRate: input.gstRate,
        description: input.description,
      },
      include: productInclude,
    });
  });
  return toProductDto(updated);
}

export async function updateStatus(id: string, input: ProductStatusInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: input.isActive },
    include: productInclude,
  });
  return toProductDto(updated);
}

function assertStorageConfigured(): void {
  if (!storage.isStorageConfigured()) {
    throw new AppError(
      "File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      503,
      "STORAGE_NOT_CONFIGURED"
    );
  }
}

function assertProductImagePath(productId: string, objectPath: string): void {
  const prefix = `products/${productId}/`;
  if (
    !objectPath.startsWith(prefix) ||
    objectPath.includes("..") ||
    objectPath.includes("\\") ||
    !/\.(jpg|jpeg|png|webp)$/i.test(objectPath)
  ) {
    throw new AppError("Invalid image path", 400, "INVALID_PATH");
  }
}

async function persistProductImage(input: {
  productId: string;
  userId: string;
  objectPath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  previousPath: string | null;
}): Promise<ProductRow> {
  const bucket = storage.storageBucket();

  await prisma.product.update({
    where: { id: input.productId },
    data: { imagePath: input.objectPath },
  });

  try {
    await prisma.fileAttachment.upsert({
      where: {
        bucket_objectPath: { bucket, objectPath: input.objectPath },
      },
      create: {
        bucket,
        objectPath: input.objectPath,
        originalName: storage.sanitizeFilename(input.originalName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        entityType: PRODUCT_IMAGE_ENTITY,
        entityId: input.productId,
        uploadedById: input.userId,
      },
      update: {
        originalName: storage.sanitizeFilename(input.originalName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        entityType: PRODUCT_IMAGE_ENTITY,
        entityId: input.productId,
        uploadedById: input.userId,
      },
    });
    if (input.previousPath && input.previousPath !== input.objectPath) {
      await prisma.fileAttachment.deleteMany({
        where: {
          entityType: PRODUCT_IMAGE_ENTITY,
          entityId: input.productId,
          objectPath: input.previousPath,
        },
      });
    }
  } catch (error) {
    logger.warn("Product image audit record failed", {
      productId: input.productId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  if (input.previousPath && input.previousPath !== input.objectPath) {
    await storage.removePrivateObject(input.previousPath);
  }

  return prisma.product.findUniqueOrThrow({
    where: { id: input.productId },
    include: productInclude,
  });
}

export async function beginImageUpload(id: string, input: ProductImageUploadUrlInput) {
  assertStorageConfigured();

  const existing = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  const mimeType = storage.normalizeImageMime(input.mimeType, input.fileName);
  if (!mimeType) {
    throw new AppError("Only JPEG, PNG, and WebP images are allowed", 400, "INVALID_FILE");
  }

  const ext = storage.extensionForImageMime(mimeType);
  const objectPath = `products/${id}/${randomUUID()}${ext}`;
  const signed = await storage.createSignedUploadUrl(objectPath);

  return {
    uploadUrl: signed.signedUrl,
    token: signed.token,
    objectPath: signed.objectPath,
    mimeType,
    maxBytes: 5 * 1024 * 1024,
  };
}

export async function confirmImageUpload(
  id: string,
  input: ProductImageConfirmInput,
  userId: string
) {
  assertStorageConfigured();
  assertProductImagePath(id, input.objectPath);

  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  let uploaded = await storage.objectExists(input.objectPath);
  for (let attempt = 0; !uploaded && attempt < 4; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    uploaded = await storage.objectExists(input.objectPath);
  }
  if (!uploaded) {
    throw new AppError("Image was not uploaded. Select the file and try again.", 400, "IMAGE_NOT_UPLOADED");
  }

  const mimeType = storage.normalizeImageMime(input.mimeType, input.originalName) ?? input.mimeType;
  const updated = await persistProductImage({
    productId: id,
    userId,
    objectPath: input.objectPath,
    originalName: input.originalName,
    mimeType,
    sizeBytes: input.sizeBytes,
    previousPath: existing.imagePath,
  });
  return toProductDto(updated);
}

export async function uploadImage(
  id: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  userId: string
) {
  assertStorageConfigured();

  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  const { mimeType } = storage.validateImageUpload({
    mimeType: file.mimetype,
    sizeBytes: file.size,
    body: file.buffer,
  });
  const ext = storage.extensionForImageMime(mimeType);
  const objectPath = `products/${id}/${randomUUID()}${ext}`;

  const uploaded = await storage.uploadPrivateObject({
    objectPath,
    body: file.buffer,
    mimeType,
  });

  const updated = await persistProductImage({
    productId: id,
    userId,
    objectPath: uploaded.objectPath,
    originalName: file.originalname,
    mimeType,
    sizeBytes: file.size,
    previousPath: existing.imagePath,
  });
  return toProductDto(updated);
}

export async function removeImage(id: string) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  if (!existing.imagePath) {
    return toProductDto(existing);
  }

  const previousPath = existing.imagePath;
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { imagePath: null } });
    await tx.fileAttachment.deleteMany({
      where: { entityType: PRODUCT_IMAGE_ENTITY, entityId: id, objectPath: previousPath },
    });
  });
  await storage.removePrivateObject(previousPath);

  const updated = await prisma.product.findUniqueOrThrow({
    where: { id },
    include: productInclude,
  });
  return toProductDto(updated);
}

async function assertProductCanBeDeleted(id: string): Promise<void> {
  const [bills, transactions, issues, wastage, stock] = await Promise.all([
    prisma.purchaseBill.count({ where: { productId: id } }),
    prisma.stockTransaction.count({ where: { productId: id } }),
    prisma.issueRecord.count({ where: { productId: id } }),
    prisma.cuttingWastage.count({ where: { fabricTypeId: id } }),
    prisma.stock.findUnique({ where: { productId: id }, select: { quantity: true } }),
  ]);

  const blockers: string[] = [];
  if (bills > 0) blockers.push(`${bills} purchase bill(s)`);
  if (transactions > 0) blockers.push(`${transactions} stock transaction(s)`);
  if (issues > 0) blockers.push(`${issues} issue record(s)`);
  if (wastage > 0) blockers.push(`${wastage} wastage record(s)`);
  if (stock && Number(stock.quantity) !== 0) blockers.push("non-zero stock");

  if (blockers.length > 0) {
    throw new AppError(
      `Cannot delete product linked to ${blockers.join(", ")}. Remove or reassign those records first.`,
      409,
      "PRODUCT_IN_USE"
    );
  }
}

export async function remove(id: string): Promise<{ id: string; message: string }> {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  await assertProductCanBeDeleted(id);

  await prisma.$transaction(async (tx) => {
    await tx.fileAttachment.deleteMany({
      where: { entityType: PRODUCT_IMAGE_ENTITY, entityId: id },
    });
    await tx.stock.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
  });

  if (product.imagePath) {
    try {
      await storage.removePrivateObject(product.imagePath);
    } catch (error) {
      logger.warn("Failed to delete product image from storage", {
        productId: id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return { id, message: "Product deleted permanently" };
}
