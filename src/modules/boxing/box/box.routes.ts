import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./box.controller";
import { boxCreateSchema, boxListQuerySchema, idParamsSchema } from "./box.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/boxing/boxes:
 *   get:
 *     tags: [Boxing - Box]
 *     summary: List packed boxes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PACKED, LOADED] }
 *       - in: query
 *         name: containerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated boxes
 *   post:
 *     tags: [Boxing - Box]
 *     summary: Pack a box and decrement finished-good stock
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [poId, poItemId, designNumber, color]
 *     responses:
 *       201:
 *         description: Created box
 */
router.get("/", validate(boxListQuerySchema, "query"), controller.list);
router.post("/", validate(boxCreateSchema), controller.create);

/**
 * @openapi
 * /api/boxing/boxes/{id}:
 *   get:
 *     tags: [Boxing - Box]
 *     summary: Get box detail with size quantities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Box
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
