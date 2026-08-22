import crypto from "crypto";
import { Prisma, UserRole } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { InviteInput, ListMembersQuery } from "./team.schema";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;
const FRONTEND_ACCEPT_INVITE_URL = "http://localhost:3000/accept-invite";

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

export interface InviteResult {
  message: string;
  inviteLink?: string;
}

function createInviteToken(): { rawToken: string; hashedToken: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  return { rawToken, hashedToken, expiresAt };
}

function buildInviteLink(rawToken: string): string {
  return `${FRONTEND_ACCEPT_INVITE_URL}?token=${rawToken}`;
}

// TODO: Replace with Resend API after domain setup
function sendInviteEmail(email: string, rawToken: string): void {
  const inviteLink = buildInviteLink(rawToken);
  console.log(`Invite email to ${email}`);
  console.log(`Invite link: ${inviteLink}`);
}

function withDevInviteLink(message: string, rawToken: string): InviteResult {
  const result: InviteResult = { message };
  if (process.env.NODE_ENV !== "production") {
    result.inviteLink = buildInviteLink(rawToken);
  }
  return result;
}

export async function invite(input: InviteInput): Promise<InviteResult> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("User with this email already exists", 400, "BAD_REQUEST");
  }

  const { rawToken, hashedToken, expiresAt } = createInviteToken();

  await prisma.user.create({
    data: {
      name: input.name,
      email,
      role: input.role,
      password: "",
      isActive: false,
      inviteToken: hashedToken,
      inviteTokenExpiry: expiresAt,
    },
  });

  sendInviteEmail(email, rawToken);
  return withDevInviteLink("Invite sent successfully", rawToken);
}

export async function listMembers(
  filters: ListMembersQuery
): Promise<{ members: TeamMember[]; total: number }> {
  const where: Prisma.UserWhereInput = {};
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const [members, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: memberSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { members, total };
}

export async function deactivate(id: string, actorUserId: string): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("Team member not found", 404, "NOT_FOUND");
  }

  if (actorUserId === id) {
    throw new AppError("You cannot deactivate your own account", 400, "BAD_REQUEST");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isActive: false },
    }),
    prisma.refreshToken.deleteMany({
      where: { userId: id },
    }),
  ]);

  return { message: "Team member deactivated" };
}

export async function resendInvite(id: string): Promise<InviteResult> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError("Team member not found", 404, "NOT_FOUND");
  }

  if (user.isActive) {
    throw new AppError("This user has already accepted their invite", 400, "BAD_REQUEST");
  }

  const { rawToken, hashedToken, expiresAt } = createInviteToken();

  await prisma.user.update({
    where: { id },
    data: {
      inviteToken: hashedToken,
      inviteTokenExpiry: expiresAt,
    },
  });

  sendInviteEmail(user.email, rawToken);
  return withDevInviteLink("Invite resent successfully", rawToken);
}
