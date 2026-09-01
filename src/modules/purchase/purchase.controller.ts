import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./purchase.service";
import {
  PurchaseCreateInput,
  PurchaseListQuery,
  PurchaseRegisterQuery,
  PurchaseReturnInput,
} from "./purchase.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as PurchaseListQuery), "Purchase bills loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Purchase bill loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as PurchaseCreateInput), "Purchase bill created", 201);
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(res, await service.confirm(req.params.id, req.user.userId), "Purchase bill confirmed");
});

export const markReturned = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.markReturned(req.params.id, req.body as PurchaseReturnInput, req.user.userId),
    "Purchase bill returned"
  );
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.register(req.query as unknown as PurchaseRegisterQuery),
    "Purchase register loaded"
  );
});

export const registerExport = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await service.registerCsv(req.query as unknown as PurchaseRegisterQuery);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});
