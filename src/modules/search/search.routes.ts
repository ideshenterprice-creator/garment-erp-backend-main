import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./search.controller";
import { searchQuerySchema } from "./search.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Global search across ERP entities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6, maximum: 10 }
 *     responses:
 *       200:
 *         description: Typed search results with navigation hrefs
 *       400:
 *         description: Query too short
 *       401:
 *         description: Unauthenticated
 */
router.get("/", validate(searchQuerySchema, "query"), controller.search);

export default router;
