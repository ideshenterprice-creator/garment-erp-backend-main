import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./sales.service";
import {
  SalesCreateInput,
  SalesListQuery,
  SalesPaymentInput,
  SalesRegisterQuery,
  SalesReturnInput,
} from "./sales.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as SalesListQuery), "Sales bills loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Sales bill loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as SalesCreateInput), "Sales bill created", 201);
});
export const submit = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.submit(req.params.id), "Sales bill submitted");
});
export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  successResponse(
    res,
    await service.recordPayment(req.params.id, req.body as SalesPaymentInput, req.user.userId),
    "Payment recorded"
  );
});
export const markReturned = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.markReturned(req.params.id, req.body as SalesReturnInput), "Sales bill returned");
});
export const register = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.register(req.query as unknown as SalesRegisterQuery), "Sales register loaded");
});
