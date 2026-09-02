import { Request, Response } from "express";
import { AppError, asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./product.service";
import {
  ProductCreateInput,
  ProductImageConfirmInput,
  ProductImageUploadUrlInput,
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

export const beginImageUpload = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.beginImageUpload(req.params.id, req.body as ProductImageUploadUrlInput),
    "Image upload URL created"
  );
});

export const confirmImageUpload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.confirmImageUpload(req.params.id, req.body as ProductImageConfirmInput, req.user.userId),
    "Product image uploaded"
  );
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new AppError("Image file is required", 400, "INVALID_FILE");
  }
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.uploadImage(req.params.id, req.file, req.user.userId),
    "Product image uploaded"
  );
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.removeImage(req.params.id), "Product image removed");
});
