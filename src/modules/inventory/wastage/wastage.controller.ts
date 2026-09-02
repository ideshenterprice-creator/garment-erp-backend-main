import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./wastage.service";
import { WastageCreateInput, WastageListQuery } from "./wastage.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as WastageListQuery), "Wastage loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Wastage loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.create(req.body as WastageCreateInput, req.user.userId),
    "Wastage recorded",
    201
  );
});

export const markSold = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(res, await service.markSold(req.params.id, req.user.userId), "Wastage marked sold");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Wastage deleted");
});
