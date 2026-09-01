import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./attachment.service";
import { AttachmentListQuery } from "./attachment.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.list(req.query as unknown as AttachmentListQuery);
  successResponse(res, result, "Attachments loaded");
});

export const signedUrl = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.signedUrl(req.params.id), "Signed URL created");
});
