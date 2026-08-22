import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./finishing.service";
import { FinishingCreateInput, FinishingListQuery } from "./finishing.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as FinishingListQuery), "Finishing entries loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Finishing entry loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  successResponse(res, await service.create(req.body as FinishingCreateInput, req.user.userId), "Finishing entry created", 201);
});
