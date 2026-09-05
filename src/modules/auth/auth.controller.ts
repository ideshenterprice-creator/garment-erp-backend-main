import { CookieOptions, Request, Response } from "express";
import { asyncHandler, AppError } from "@/middleware/errorHandler";
import { successResponse } from "@/utils/apiResponse";
import { cookieSameSite, isProduction, refreshCookieMaxAgeMs } from "@/config/env";
import * as authService from "./auth.service";
import { AcceptInviteInput, LoginInput } from "./auth.schema";

const REFRESH_COOKIE_NAME = "refreshToken";

function refreshCookieOptions(): CookieOptions {
  const sameSite = cookieSameSite();
  return {
    httpOnly: true,
    secure: isProduction() || sameSite === "none",
    sameSite,
    maxAge: refreshCookieMaxAgeMs(),
    path: "/",
  };
}

function clearRefreshCookie(res: Response): void {
  const options = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite,
    path: "/",
  });
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
  try {
    const result = await authService.refresh(readRefreshCookie(req));
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions());
    successResponse(res, { accessToken: result.accessToken }, "Token refreshed");
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
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
