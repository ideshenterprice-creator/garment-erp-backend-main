import { CookieOptions, Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import * as authService from "./auth.service";
import { AcceptInviteInput, LoginInput } from "./auth.schema";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_MAX_AGE_MS,
    path: "/",
  };
}

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.refreshToken;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body as LoginInput);
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
  successResponse(
    res,
    {
      accessToken: result.accessToken,
      user: result.user,
    },
    "Login successful"
  );
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(readRefreshCookie(req));
  successResponse(res, result, "Token refreshed");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.logout(readRefreshCookie(req));
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  successResponse(res, result, result.message);
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.acceptInvite(req.body as AcceptInviteInput);
  successResponse(res, result, result.message);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  }
  const user = await authService.me(req.user.userId);
  successResponse(res, user, "Profile loaded");
});
