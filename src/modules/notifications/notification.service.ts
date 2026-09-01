import { Prisma } from "@prisma/client";
import prisma from "@/config/database";
import logger from "@/config/logger";
import { AppError } from "@/middleware/errorHandler";
import { lowStockThreshold } from "@/config/env";
import { NotificationListQuery } from "./notification.schema";

export const NotificationType = {
  PURCHASE_ORDER_CREATED: "PURCHASE_ORDER_CREATED",
  PURCHASE_RECEIVED: "PURCHASE_RECEIVED",
  LOW_STOCK: "LOW_STOCK",
  PRODUCTION_COMPLETED: "PRODUCTION_COMPLETED",
  SALES_BILL_CREATED: "SALES_BILL_CREATED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  PARTY_CREATED: "PARTY_CREATED",
  PRODUCT_CREATED: "PRODUCT_CREATED",
  TEAM_INVITATION: "TEAM_INVITATION",
} as const;

export interface NotifyPayload {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}

function hrefForType(type: string, metadata?: Record<string, unknown>): string | undefined {
  const entityId = typeof metadata?.entityId === "string" ? metadata.entityId : undefined;
  switch (type) {
    case NotificationType.PURCHASE_ORDER_CREATED:
      return entityId ? `/purchase-orders/${entityId}` : "/purchase-orders";
    case NotificationType.PURCHASE_RECEIVED:
      return entityId ? `/purchase/bills/${entityId}` : "/purchase/bills";
    case NotificationType.LOW_STOCK:
      return "/inventory/stock";
    case NotificationType.PRODUCTION_COMPLETED:
      return typeof metadata?.bundleNumber === "string"
        ? `/production/bundles/${metadata.bundleNumber}`
        : "/production";
    case NotificationType.SALES_BILL_CREATED:
      return entityId ? `/sales/bills/${entityId}` : "/sales/bills";
    case NotificationType.PAYMENT_RECORDED:
      return entityId ? `/sales/bills/${entityId}` : "/accounts/statement";
    case NotificationType.PARTY_CREATED:
      return entityId ? `/masters/party/${entityId}` : "/masters/party";
    case NotificationType.PRODUCT_CREATED:
      return entityId ? `/masters/product/${entityId}` : "/masters/product";
    case NotificationType.TEAM_INVITATION:
      return "/team";
    default:
      return undefined;
  }
}

export async function list(userId: string, query: NotificationListQuery) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (query.unreadOnly) where.isRead = false;
  if (query.type) where.type = query.type;

  const [data, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
    unreadCount,
  };
}

export async function unreadCount(userId: string): Promise<{ unreadCount: number }> {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { unreadCount: count };
}

export async function markRead(userId: string, id: string) {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) {
    throw new AppError("Notification not found", 404, "NOT_FOUND");
  }
  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}

export async function remove(userId: string, id: string): Promise<{ message: string }> {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) {
    throw new AppError("Notification not found", 404, "NOT_FOUND");
  }
  await prisma.notification.delete({ where: { id } });
  return { message: "Notification deleted" };
}

export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  if (userIds.length === 0) return;

  const metadata = {
    ...(payload.metadata ?? {}),
    href: hrefForType(payload.type, payload.metadata),
    ...(payload.dedupeKey ? { dedupeKey: payload.dedupeKey } : {}),
  };

  if (payload.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        type: payload.type,
        metadata: { path: ["dedupeKey"], equals: payload.dedupeKey },
      },
      select: { id: true },
    });
    if (existing) return;
  }

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      metadata,
    })),
  });
}

export async function notifyActiveUsers(payload: NotifyPayload): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    await notifyUsers(
      users.map((user) => user.id),
      payload
    );
  } catch (error) {
    logger.error("Failed to create notifications", {
      type: payload.type,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function notifyAdmins(payload: NotifyPayload): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: "ADMIN" },
      select: { id: true },
    });
    await notifyUsers(
      users.map((user) => user.id),
      payload
    );
  } catch (error) {
    logger.error("Failed to create admin notifications", {
      type: payload.type,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function maybeNotifyLowStock(productId: string): Promise<void> {
  try {
    const stock = await prisma.stock.findUnique({
      where: { productId },
      include: { product: { select: { name: true, productCode: true } } },
    });
    if (!stock) return;
    const quantity = Number(stock.quantity);
    if (quantity > lowStockThreshold()) return;

    await notifyActiveUsers({
      type: NotificationType.LOW_STOCK,
      title: "Low stock alert",
      message: `${stock.product.name} (${stock.product.productCode}) is at ${quantity}.`,
      metadata: { entityType: "PRODUCT", entityId: productId, quantity },
      dedupeKey: `LOW_STOCK:${productId}:${Math.floor(quantity)}`,
    });
  } catch (error) {
    logger.error("Low stock notification failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
