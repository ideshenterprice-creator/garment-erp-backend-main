import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./party.service";
import { PartyCreateInput, PartyListQuery, PartyStatusInput, PartyUpdateInput } from "./party.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(req.query as unknown as PartyListQuery);
  successResponse(res, result, "Parties loaded");
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Party loaded");
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as PartyCreateInput), "Party created", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.update(req.params.id, req.body as PartyUpdateInput), "Party updated");
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  successResponse(
    res,
    await service.updateStatus(req.params.id, req.body as PartyStatusInput),
    "Party status updated"
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.remove(req.params.id), "Party deleted");
});
