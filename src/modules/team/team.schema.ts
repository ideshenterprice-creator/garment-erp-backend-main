import { z } from "zod";

export const inviteSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(["ADMIN", "TEAM_MEMBER"]),
});

export const listMembersQuerySchema = z.object({
  role: z.enum(["ADMIN", "TEAM_MEMBER"]).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const memberIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type MemberIdParams = z.infer<typeof memberIdParamsSchema>;
