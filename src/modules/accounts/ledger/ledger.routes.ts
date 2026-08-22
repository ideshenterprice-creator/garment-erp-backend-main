import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import * as controller from "./ledger.controller";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/ledger:
 *   get:
 *     tags: [Accounts - Ledger]
 *     summary: List ledger entries (optional partyId filter)
 *     parameters:
 *       - in: query
 *         name: partyId
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 */
router.get("/", controller.list);

/**
 * @openapi
 * /api/ledger/{partyId}:
 *   get:
 *     tags: [Accounts - Ledger]
 *     summary: Party ledger
 *     parameters:
 *       - in: path
 *         name: partyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ledger }
 */
router.get("/:partyId", controller.getByParty);

export default router;
