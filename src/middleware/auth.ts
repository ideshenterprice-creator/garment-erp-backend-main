import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthPayload } from "@/types";
import { errorResponse } from "@/utils/apiResponse";

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }
  return secret;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    errorResponse(res, "Access token required", "UNAUTHORIZED", undefined, 401);
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, getAccessSecret()) as AuthPayload;
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    errorResponse(res, "Invalid or expired access token", "UNAUTHORIZED", undefined, 401);
  }
}
