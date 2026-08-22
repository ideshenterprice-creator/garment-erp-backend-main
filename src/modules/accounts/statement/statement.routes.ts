import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./statement.controller";
import { statementQuerySchema } from "./statement.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/accounts/statement:
 *   get:
 *     tags: [Accounts - Statement]
 *     summary: Party ledger statement with running balance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: partyId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Statement
 */
router.get("/", validate(statementQuerySchema, "query"), controller.getStatement);

export default router;
