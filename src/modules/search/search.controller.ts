import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./search.service";
import { SearchQuery } from "./search.schema";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.globalSearch(req.query as unknown as SearchQuery);
  successResponse(res, result, "Search results");
});
