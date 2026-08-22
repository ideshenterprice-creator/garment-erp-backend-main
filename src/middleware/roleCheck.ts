import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { errorResponse } from "@/utils/apiResponse";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    errorResponse(res, "Admin access required", "FORBIDDEN", undefined, 403);
    return;
  }
  next();
}

export function requireTeamMember(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    errorResponse(res, "Authentication required", "FORBIDDEN", undefined, 403);
    return;
  }
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.TEAM_MEMBER) {
    errorResponse(res, "Insufficient role", "FORBIDDEN", undefined, 403);
    return;
  }
  next();
}
