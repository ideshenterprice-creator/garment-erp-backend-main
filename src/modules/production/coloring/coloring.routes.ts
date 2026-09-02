import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./coloring.controller";
import { coloringCreateSchema, coloringListQuerySchema, idParamsSchema } from "./coloring.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/coloring:
 *   get:
 *     tags: [Production - Coloring]
 *     summary: List coloring entries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list
 *   post:
 *     tags: [Production - Coloring]
 *     summary: Record coloring and create pending karigar payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryDate, bundleId, poId, karigarId, colorApplied, piecesReturned]
 *     responses:
 *       201:
 *         description: Entry plus payment
 */
router.get("/", validate(coloringListQuerySchema, "query"), controller.list);
router.post("/", validate(coloringCreateSchema), controller.create);

/**
 * @openapi
 * /api/production/coloring/{id}:
 *   get:
 *     tags: [Production - Coloring]
 *     summary: Get a coloring entry
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
