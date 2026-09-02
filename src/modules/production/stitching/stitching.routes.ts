import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./stitching.controller";
import { idParamsSchema, stitchingCreateSchema, stitchingListQuerySchema } from "./stitching.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/stitching:
 *   get:
 *     tags: [Production - Stitching]
 *     summary: List stitching entries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list
 *   post:
 *     tags: [Production - Stitching]
 *     summary: Record one stitching operation for a bundle
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryDate, bundleId, poId, karigarId, operationId, piecesGiven, piecesReturned]
 *     responses:
 *       201:
 *         description: Entry plus payment. Advances to FINISHING when all assigned ops are done.
 */
router.get("/", validate(stitchingListQuerySchema, "query"), controller.list);
router.post("/", validate(stitchingCreateSchema), controller.create);

/**
 * @openapi
 * /api/production/stitching/{id}:
 *   get:
 *     tags: [Production - Stitching]
 *     summary: Get a stitching entry
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
