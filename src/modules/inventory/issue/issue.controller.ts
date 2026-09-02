import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./issue.service";
import { IssueCreateInput, IssueListQuery, IssueReturnInput } from "./issue.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as IssueListQuery), "Issues loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Issue loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  const result = await service.create(req.body as IssueCreateInput, req.user.userId);
  successResponse(res, result, `Issue created. Bundle number: ${result.bundleNumber}`, 201);
});

export const markReturned = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  successResponse(
    res,
    await service.markReturned(req.params.id, req.body as IssueReturnInput, req.user.userId),
    "Issue return recorded"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Issue deleted");
});
