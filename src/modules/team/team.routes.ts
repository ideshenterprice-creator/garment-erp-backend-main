import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./team.controller";
import { inviteSchema, listMembersQuerySchema, memberIdParamsSchema } from "./team.schema";

const router = Router();

router.use(authenticate, requireAdmin);

/**
 * @openapi
 * /api/team/invite:
 *   post:
 *     tags: [Team]
 *     summary: Invite a team member by email
 *     description: Admin only. Creates an inactive user and logs an invite link until Resend is configured.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [ADMIN, TEAM_MEMBER]
 *     responses:
 *       201:
 *         description: Invite created. inviteLink is included in development only.
 *       400:
 *         description: User with this email already exists
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Admin access required
 */
router.post("/invite", validate(inviteSchema), controller.invite);

/**
 * @openapi
 * /api/team/members:
 *   get:
 *     tags: [Team]
 *     summary: List team members
 *     description: Admin only. Never returns password or invite token fields.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, TEAM_MEMBER]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *     responses:
 *       200:
 *         description: Members array with total count
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Admin access required
 */
router.get("/members", validate(listMembersQuerySchema, "query"), controller.listMembers);

/**
 * @openapi
 * /api/team/members/{id}/deactivate:
 *   patch:
 *     tags: [Team]
 *     summary: Deactivate a team member and revoke their sessions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Team member deactivated
 *       400:
 *         description: Cannot deactivate your own account
 *       404:
 *         description: Team member not found
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Admin access required
 */
router.patch(
  "/members/:id/deactivate",
  validate(memberIdParamsSchema, "params"),
  controller.deactivate
);

/**
 * @openapi
 * /api/team/resend-invite/{id}:
 *   post:
 *     tags: [Team]
 *     summary: Resend invite email with a new token
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invite resent. inviteLink is included in development only.
 *       400:
 *         description: User has already accepted their invite
 *       404:
 *         description: Team member not found
 *       401:
 *         description: Missing or invalid access token
 *       403:
 *         description: Admin access required
 */
router.post(
  "/resend-invite/:id",
  validate(memberIdParamsSchema, "params"),
  controller.resendInvite
);

export default router;
