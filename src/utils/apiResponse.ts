import { Request, Response } from "express";
import { SuccessBody, ErrorBody } from "@/types";

export function successResponse<T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200
): Response<SuccessBody<T>> {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(
  res: Response,
  message: string,
  code = "BAD_REQUEST",
  details?: unknown,
  statusCode = 400
): Response<ErrorBody> {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}

export function getRequestId(_req: Request): string | undefined {
  return undefined;
}
