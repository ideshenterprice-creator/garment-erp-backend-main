import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./statement.service";
import { StatementQuery } from "./statement.schema";

export const getStatement = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.partyStatement(req.query as unknown as StatementQuery), "Statement loaded");
});

export const exportStatement = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await service.partyStatementCsv(req.query as unknown as StatementQuery);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
});
