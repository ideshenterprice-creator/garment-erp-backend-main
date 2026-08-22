import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./container.service";
import { AddBoxInput, ContainerCreateInput, ContainerListQuery, DispatchInput } from "./container.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as ContainerListQuery), "Containers loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Container loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as ContainerCreateInput), "Container created", 201);
});
export const addBox = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.addBox(req.params.id, req.body as AddBoxInput), "Box added to container");
});
export const markReady = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.markReady(req.params.id), "Container marked ready");
});
export const markDispatched = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.markDispatched(req.params.id, req.body as DispatchInput), "Container dispatched");
});
