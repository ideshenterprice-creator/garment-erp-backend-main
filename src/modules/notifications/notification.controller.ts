import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./notification.service";
import { NotificationListQuery } from "./notification.schema";

function requireUser(req: Request): { userId: string } {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = requireUser(req);
  const result = await service.list(userId, req.query as unknown as NotificationListQuery);
  successResponse(res, result, "Notifications loaded");
});

export const unread = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = requireUser(req);
  successResponse(res, await service.unreadCount(userId), "Unread count loaded");
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = requireUser(req);
  successResponse(res, await service.markRead(userId, req.params.id), "Notification marked as read");
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = requireUser(req);
  successResponse(res, await service.markAllRead(userId), "All notifications marked as read");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = requireUser(req);
  const result = await service.remove(userId, req.params.id);
  successResponse(res, result, result.message);
});
