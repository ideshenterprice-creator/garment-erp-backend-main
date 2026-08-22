import { Request, Response } from "express";
import { asyncHandler } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as service from "./notes.service";
import { NoteCreateInput, NotesListQuery } from "./notes.schema";

export const list = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.list(req.query as unknown as NotesListQuery), "Notes loaded");
});
export const getById = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.getById(req.params.id), "Note loaded");
});
export const create = asyncHandler(async (req: Request, res: Response) => {
  successResponse(res, await service.create(req.body as NoteCreateInput), "Note created", 201);
});
