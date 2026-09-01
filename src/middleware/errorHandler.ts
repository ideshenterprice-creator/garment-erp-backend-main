import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import logger from "@/config/logger";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    void fn(req, res, next).catch(next);
  };

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error("Request failed", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : "unknown",
  });

  const exposeDetails = process.env.NODE_ENV !== "production";

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Request validation failed",
      code: "VALIDATION_ERROR",
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({
        success: false,
        message: "Already exists",
        code: "ALREADY_EXISTS",
        error: {
          code: "ALREADY_EXISTS",
          message: "Already exists",
          ...(exposeDetails ? { details: err.meta } : {}),
        },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        success: false,
        message: "Record not found",
        code: "NOT_FOUND",
        error: {
          code: "NOT_FOUND",
          message: "Record not found",
        },
      });
      return;
    }
    res.status(400).json({
      success: false,
      message: "Database request failed",
      code: "DATABASE_ERROR",
      error: {
        code: "DATABASE_ERROR",
        message: "Database request failed",
      },
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "INTERNAL_ERROR",
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  });
}
