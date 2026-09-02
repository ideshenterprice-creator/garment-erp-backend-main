import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./cutting.service";
import { CuttingCreateInput, CuttingListQuery } from "./cutting.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as CuttingListQuery), "Cutting entries loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Cutting entry loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  const result = await service.create(req.body as CuttingCreateInput, req.user.userId);
  successResponse(res, result, "Cutting entry created", 201);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Cutting entry deleted");
});
