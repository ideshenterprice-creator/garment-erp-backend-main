import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./designation.service";
import {
  DesignationCreateInput,
  DesignationListQuery,
  DesignationStatusInput,
  DesignationUpdateInput,
} from "./designation.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.list(req.query as unknown as DesignationListQuery),
    "Designations loaded"
  );
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Designation loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.create(req.body as DesignationCreateInput),
    "Designation created",
    201
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.update(req.params.id, req.body as DesignationUpdateInput),
    "Designation updated"
  );
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.updateStatus(req.params.id, req.body as DesignationStatusInput),
    "Designation status updated"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Designation deleted");
});
