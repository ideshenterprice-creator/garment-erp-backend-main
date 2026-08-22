import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./supplierPayment.service";
import { SupplierPaymentCreateInput, SupplierPaymentListQuery } from "./supplierPayment.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as SupplierPaymentListQuery), "Supplier bills loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Supplier bill payments loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as SupplierPaymentCreateInput), "Supplier payment recorded", 201);
});
