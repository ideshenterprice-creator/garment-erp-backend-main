import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./printing.controller";
import { idParamsSchema, printingCreateSchema, printingListQuerySchema } from "./printing.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/printing:
 *   get:
 *     tags: [Production - Printing]
 *     summary: List printing entries
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list with summary
 *   post:
 *     tags: [Production - Printing]
 *     summary: Record printing and create pending karigar payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entryDate, bundleId, poId, karigarId, piecesReturned]
 *     responses:
 *       201:
 *         description: Entry plus payment
 */
router.get("/", validate(printingListQuerySchema, "query"), controller.list);
router.post("/", validate(printingCreateSchema), controller.create);

/**
 * @openapi
 * /api/production/printing/{id}:
 *   get:
 *     tags: [Production - Printing]
 *     summary: Get a printing entry
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
