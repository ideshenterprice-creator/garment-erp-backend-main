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

export const registerExport = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await service.registerCsv(req.query as unknown as SalesRegisterQuery);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});

export const invoicePdf = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  const { filename, buffer } = await service.invoicePdf(req.params.id, req.user.userId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(buffer);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Sales bill deleted");
});
