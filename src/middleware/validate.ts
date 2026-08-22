import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { errorResponse } from "@/utils/apiResponse";

type RequestPart = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: RequestPart = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req[part]);
    if (!parsed.success) {
      errorResponse(
        res,
        "Validation failed",
        "VALIDATION_ERROR",
        parsed.error.flatten().fieldErrors,
        400
      );
      return;
    }

    if (part === "query") {
      Object.assign(req.query, parsed.data as Record<string, unknown>);
    } else if (part === "params") {
      Object.assign(req.params, parsed.data as Record<string, unknown>);
    } else {
      req.body = parsed.data;
    }
    next();
  };
}
