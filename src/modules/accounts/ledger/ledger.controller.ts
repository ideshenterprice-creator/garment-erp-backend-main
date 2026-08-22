import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./ledger.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const partyId = typeof req.query.partyId === "string" ? req.query.partyId : undefined;
  successResponse(res, await service.list(partyId), "Ledger loaded");
});

export const getByParty = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getByParty(req.params.partyId), "Party ledger loaded");
});
