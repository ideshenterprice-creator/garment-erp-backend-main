import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./karigarPayment.service";
import { KarigarConfirmInput, KarigarListQuery } from "./karigarPayment.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as KarigarListQuery), "Karigar payments loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Karigar payment loaded");
});
export const confirm = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.confirm(req.params.id, req.body as KarigarConfirmInput), "Karigar payment confirmed");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Karigar payment deleted");
});
