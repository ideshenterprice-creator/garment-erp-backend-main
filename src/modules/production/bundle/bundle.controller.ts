import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./bundle.service";
import { BundleListQuery } from "./bundle.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as BundleListQuery), "Bundles loaded");
});

export const getByNumber = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getByNumber(req.params.bundleNumber), "Bundle loaded");
});

export const journey = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getJourney(req.params.bundleNumber), "Bundle journey loaded");
});

export const payments = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getPayments(req.params.bundleNumber), "Bundle payments loaded");
});
