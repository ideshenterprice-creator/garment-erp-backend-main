import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./stitching.service";
import { StitchingCreateInput, StitchingListQuery } from "./stitching.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as StitchingListQuery), "Stitching entries loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Stitching entry loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as StitchingCreateInput), "Stitching entry created", 201);
});
