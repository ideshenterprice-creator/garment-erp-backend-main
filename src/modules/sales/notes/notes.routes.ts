import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./notes.controller";
import { idParamsSchema, noteCreateSchema, notesListQuerySchema } from "./notes.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/sales/notes:
 *   get:
 *     tags: [Sales - Notes]
 *     summary: List credit and debit notes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [CREDIT, DEBIT] }
 *       - in: query
 *         name: buyerId
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
 *         description: Paginated notes
 *   post:
 *     tags: [Sales - Notes]
 *     summary: Create a credit or debit note
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, salesBillId, amount, reason, date]
 *     responses:
 *       201:
 *         description: Created
 */
router.get("/", validate(notesListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(noteCreateSchema), controller.create);

/**
 * @openapi
 * /api/sales/notes/{id}:
 *   get:
 *     tags: [Sales - Notes]
 *     summary: Get credit/debit note
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Note
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
