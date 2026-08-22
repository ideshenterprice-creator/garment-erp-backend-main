import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./stock.service";
import { StockAdjustInput, StockHistoryQuery, StockListQuery } from "./stock.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as StockListQuery), "Stock loaded");
});

export const getByProduct = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getByProduct(req.params.productId), "Stock loaded");
});

export const history = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.history(req.params.productId, req.query as unknown as StockHistoryQuery),
    "Stock history loaded"
  );
});

export const adjust = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.adjust(req.params.productId, req.body as StockAdjustInput, req.user.userId),
    "Stock adjusted"
  );
});
