import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./po.service";
import { POCancelInput, POCreateInput, POListQuery, POUpdateInput } from "./po.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as POListQuery), "Purchase orders loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Purchase order loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as POCreateInput), "Purchase order created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.update(req.params.id, req.body as POUpdateInput), "Purchase order updated");
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.cancel(req.params.id, req.body as POCancelInput), "Purchase order cancelled");
});

export const productionStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getProductionStatus(req.params.id), "Production status loaded");
});

export const fabricLots = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getFabricLots(req.params.id), "Fabric lots loaded");
});
