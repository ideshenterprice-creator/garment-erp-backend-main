import { Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as teamService from "./team.service";
import { InviteInput, ListMembersQuery } from "./team.schema";

export const invite = asyncHandler(async (req: Request, res: Response) => {
  const result = await teamService.invite(req.body as InviteInput);
  successResponse(res, result, result.message, 201);
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListMembersQuery;
  const result = await teamService.listMembers(query);
  successResponse(res, result, "Team members loaded");
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  const result = await teamService.deactivate(req.params.id, req.user.userId);
  successResponse(res, result, result.message);
});

export const resendInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await teamService.resendInvite(req.params.id);
  successResponse(res, result, result.message);
});
