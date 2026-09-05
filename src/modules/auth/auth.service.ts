import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import prisma from "@/config/database";
import { refreshCookieMaxAgeMs } from "@/config/env";
import { AppError } from "@/middleware/errorHandler";
import { AcceptInviteInput, LoginInput } from "./auth.schema";

const BCRYPT_ROUNDS = 12;

interface AccessTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
}

interface RefreshTokenPayload {
  userId: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthMeUser extends AuthUser {
  isActive: boolean;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function accessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }
  return secret;
}

function refreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }
  return secret;
}

function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? "15m") as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, accessSecret(), options);
}

function signRefreshToken(payload: RefreshTokenPayload): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, refreshSecret(), options);
}

function hashInviteToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function toAuthUser(user: { id: string; name: string; email: string; role: UserRole }): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function readUserIdFromRefresh(decoded: string | JwtPayload): string {
  if (typeof decoded === "string" || typeof decoded.userId !== "string") {
    throw new AppError("Invalid refresh token", 401, "UNAUTHORIZED");
  }
  return decoded.userId;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  if (!user.isActive) {
    throw new AppError("Account not activated. Check your invite email.", 403, "FORBIDDEN");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    throw new AppError("Invalid credentials", 401, "UNAUTHORIZED");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = signRefreshToken({ userId: user.id });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshCookieMaxAgeMs()),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
}

export async function refresh(
  refreshToken: string | undefined
): Promise<{ accessToken: string; refreshToken: string }> {
  if (!refreshToken) {
    throw new AppError("No refresh token", 401, "UNAUTHORIZED");
  }

  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, refreshSecret());
  } catch {
    throw new AppError("Invalid refresh token", 401, "UNAUTHORIZED");
  }

  const userId = readUserIdFromRefresh(decoded);

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored) {
    throw new AppError("Refresh token revoked or not found", 401, "UNAUTHORIZED");
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    throw new AppError("Token expired", 401, "UNAUTHORIZED");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError("Invalid refresh token", 401, "UNAUTHORIZED");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Reuse the same refresh token. Rotating on every refresh races when the
  // browser, multiple tabs, or React Strict Mode hit /auth/refresh twice.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { expiresAt: new Date(Date.now() + refreshCookieMaxAgeMs()) },
  });

  return { accessToken, refreshToken };
}

export async function logout(refreshToken: string | undefined): Promise<{ message: string }> {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  return { message: "Logged out successfully" };
}

export async function acceptInvite(input: AcceptInviteInput): Promise<{ message: string }> {
  const hashedToken = hashInviteToken(input.token);

  const user = await prisma.user.findFirst({
    where: { inviteToken: hashedToken },
  });

  if (!user) {
    throw new AppError("Invalid invite link", 400, "BAD_REQUEST");
  }

  if (!user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    throw new AppError("Invite link has expired. Ask admin to resend.", 400, "BAD_REQUEST");
  }

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      isActive: true,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  return { message: "Account activated. You can now login." };
}

export async function me(userId: string): Promise<AuthMeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AppError("Invalid or expired access token", 401, "UNAUTHORIZED");
  }

  return user;
}
