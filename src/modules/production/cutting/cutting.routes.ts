import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./cutting.controller";
import { cuttingCreateSchema, cuttingListQuerySchema, idParamsSchema } from "./cutting.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/cutting:
 *   get:
 *     tags: [Production - Cutting]
 *     summary: List cutting entries with payment due summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: karigarId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: bundleId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit, summary }"
 *   post:
 *     tags: [Production - Cutting]
 *     summary: Record cutting, advance bundle to PRINTING, create pending karigar payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryDate, bundleId, poId, poItemId, karigarId, wastageKg]
 *     responses:
 *       201:
 *         description: Entry plus payment amount
 */
router.get("/", validate(cuttingListQuerySchema, "query"), controller.list);
router.post("/", validate(cuttingCreateSchema), controller.create);

/**
 * @openapi
 * /api/production/cutting/{id}:
 *   get:
 *     tags: [Production - Cutting]
 *     summary: Get a cutting entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Entry
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
