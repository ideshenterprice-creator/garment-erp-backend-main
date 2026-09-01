import crypto from "crypto";
import { Prisma, UserRole } from "@prisma/client";
import prisma from "@/config/database";
import { AppError } from "@/middleware/errorHandler";
import { frontendUrl, inviteTtlMs, isProduction } from "@/config/env";
import { sendInviteEmail } from "@/services/email/email.service";
import { notifyAdmins, NotificationType } from "@/modules/notifications/notification.service";
import { InviteInput, ListMembersQuery } from "./team.schema";

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  inviteToken: true,
} as const;

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  inviteAccepted: boolean;
};

export interface InviteResult {
  message: string;
  inviteLink?: string;
}

function createInviteToken(): { rawToken: string; hashedToken: string; expiresAt: Date } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + inviteTtlMs());
  return { rawToken, hashedToken, expiresAt };
}

function buildInviteLink(rawToken: string): string {
  return `${frontendUrl()}/accept-invite?token=${rawToken}`;
}

function withDevInviteLink(message: string, rawToken: string): InviteResult {
  const result: InviteResult = { message };
  if (!isProduction()) {
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
  const inviteLink = buildInviteLink(rawToken);

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

  await sendInviteEmail(email, inviteLink);
  void notifyAdmins({
    type: NotificationType.TEAM_INVITATION,
    title: "Team invitation sent",
    message: `${input.name} (${email}) was invited as ${input.role}.`,
    metadata: { entityType: "USER", email },
    dedupeKey: `TEAM_INVITE:${email}:${hashedToken.slice(0, 12)}`,
  });

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

  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: memberSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  const members: TeamMember[] = rows.map(({ inviteToken, ...member }) => ({
    ...member,
    inviteAccepted: inviteToken === null,
  }));

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
  const inviteLink = buildInviteLink(rawToken);

  await prisma.user.update({
    where: { id },
    data: {
      inviteToken: hashedToken,
      inviteTokenExpiry: expiresAt,
    },
  });

  await sendInviteEmail(user.email, inviteLink);
  return withDevInviteLink("Invite resent successfully", rawToken);
}
