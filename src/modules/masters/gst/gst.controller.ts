import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./gst.service";
import { GstCreateInput, GstUpdateInput } from "./gst.schema";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  successResponse(res, await service.list(), "GST rates loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "GST rate loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as GstCreateInput), "GST rate created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.update(req.params.id, req.body as GstUpdateInput), "GST rate updated");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "GST rate deleted");
});
