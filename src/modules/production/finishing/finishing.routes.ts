import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./finishing.controller";
import { finishingCreateSchema, finishingListQuerySchema, idParamsSchema } from "./finishing.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/finishing:
 *   get:
 *     tags: [Production - Finishing]
 *     summary: List finishing entries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list
 *   post:
 *     tags: [Production - Finishing]
 *     summary: Record one finishing operation, update finished-good stock, create payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryDate, bundleId, poId, karigarId, operationId, piecesReceived, piecesCompleted]
 *     responses:
 *       201:
 *         description: Entry, payment, and stockUpdated flag
 */
router.get("/", validate(finishingListQuerySchema, "query"), controller.list);
router.post("/", validate(finishingCreateSchema), controller.create);

/**
 * @openapi
 * /api/production/finishing/{id}:
 *   get:
 *     tags: [Production - Finishing]
 *     summary: Get a finishing entry
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

export default router;
