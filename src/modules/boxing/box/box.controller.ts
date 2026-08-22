import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./box.service";
import { BoxCreateInput, BoxListQuery } from "./box.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as BoxListQuery), "Boxes loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Box loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  successResponse(res, await service.create(req.body as BoxCreateInput, req.user.userId), "Box packed", 201);
});
