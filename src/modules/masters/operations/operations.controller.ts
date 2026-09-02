import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./operations.service";
import {
  OperationCreateInput,
  OperationListQuery,
  OperationStatusInput,
  OperationUpdateInput,
} from "./operations.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as OperationListQuery), "Operations loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Operation loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as OperationCreateInput), "Operation created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.update(req.params.id, req.body as OperationUpdateInput);
  successResponse(res, result, result.note ?? "Operation updated");
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.updateStatus(req.params.id, req.body as OperationStatusInput),
    "Operation status updated"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Operation deleted");
});
