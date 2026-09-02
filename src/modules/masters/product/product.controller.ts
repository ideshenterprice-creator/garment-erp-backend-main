import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./product.service";
import {
  ProductCreateInput,
  ProductListQuery,
  ProductStatusInput,
  ProductUpdateInput,
} from "./product.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as ProductListQuery), "Products loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Product loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as ProductCreateInput), "Product created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.update(req.params.id, req.body as ProductUpdateInput), "Product updated");
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.updateStatus(req.params.id, req.body as ProductStatusInput),
    "Product status updated"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Product deleted");
});
