import { Prisma, ProductCategory, SizeLabel } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { ProductCreateInput, ProductListQuery, ProductStatusInput, ProductUpdateInput } from "./product.schema";

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

async function nextProductCode(category: ProductCategory): Promise<string> {
  const prefix = PRODUCT_PREFIX[category];
  const count = await prisma.product.count({
    where: { productCode: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function list(query: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (query.category) where.category = query.category;
  if (query.isActive !== undefined) where.isActive = query.isActive;
  if (query.search) {
    where.name = { contains: query.search, mode: "insensitive" };
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

  const data = rows.map((product) => {
    if (product.category !== "FINISHED_GOOD") {
      const { sizes: _sizes, ...rest } = product;
      return rest;
    }
    return product;
  });

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
  if (product.category !== "FINISHED_GOOD") {
    const { sizes: _sizes, ...rest } = product;
    return rest;
  }
  return product;
}

export async function create(input: ProductCreateInput) {
  const productCode = await nextProductCode(input.category);
  const sizes =
    input.category === "FINISHED_GOOD" && input.sizes?.length
      ? input.sizes.map((sizeLabel) => ({ sizeLabel: sizeLabel as SizeLabel }))
      : [];

  return prisma.$transaction(async (tx) => {
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
}

export async function update(id: string, input: ProductUpdateInput) {
  const existing = await prisma.product.findUnique({ where: { id }, include: { sizes: true } });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }

  const category = input.category ?? existing.category;

  return prisma.$transaction(async (tx) => {
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
}

export async function updateStatus(id: string, input: ProductStatusInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Product not found", 404, "NOT_FOUND");
  }
  return prisma.product.update({
    where: { id },
    data: { isActive: input.isActive },
    include: productInclude,
  });
}
