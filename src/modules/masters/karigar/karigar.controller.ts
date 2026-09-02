import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./karigar.service";
import {
  KarigarCreateInput,
  KarigarListQuery,
  KarigarPaymentsQuery,
  KarigarStatusInput,
  KarigarUpdateInput,
} from "./karigar.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as KarigarListQuery), "Karigar profiles loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Karigar profile loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as KarigarCreateInput), "Karigar profile created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.update(req.params.id, req.body as KarigarUpdateInput), "Karigar profile updated");
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.updateStatus(req.params.id, req.body as KarigarStatusInput),
    "Karigar profile status updated"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Karigar deleted");
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.listPayments(req.params.id, req.query as unknown as KarigarPaymentsQuery),
    "Karigar payments loaded"
  );
});
