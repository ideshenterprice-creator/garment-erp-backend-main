import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./operations.controller";
import {
  idParamsSchema,
  operationCreateSchema,
  operationListQuerySchema,
  operationStatusSchema,
  operationUpdateSchema,
} from "./operations.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/masters/operations:
 *   get:
 *     tags: [Masters - Operations]
 *     summary: List operations and rates (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: stage
 *         schema: { type: string, enum: [CUTTING, PRINTING, COLORING, STITCHING, FINISHING] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: department
 *         schema: { type: string }
 *       - in: query
 *         name: departmentType
 *         schema:
 *           type: string
 *           enum: [FLATLOCK, OVERLOCK, LOCK_STITCH, IRON, CUTTING_MACHINE, PRINTING_MACHINE, COLORING_MACHINE, OTHER]
 *       - in: query
 *         name: lotNo
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit }"
 *   post:
 *     tags: [Masters - Operations]
 *     summary: Create an operation with piece rate (OP-001...)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, stage, ratePerPiece]
 *             properties:
 *               name: { type: string }
 *               stage: { type: string, enum: [CUTTING, PRINTING, COLORING, STITCHING, FINISHING] }
 *               ratePerPiece: { type: number, minimum: 0 }
 *               unit: { type: string, default: per piece }
 *               lotNo: { type: string, description: "Optional lot number e.g. LOT-001" }
 *               department: { type: string, description: "Machine/department within stage e.g. Flatlock Machine" }
 *               departmentType:
 *                 type: string
 *                 enum: [FLATLOCK, OVERLOCK, LOCK_STITCH, IRON, CUTTING_MACHINE, PRINTING_MACHINE, COLORING_MACHINE, OTHER]
 *                 description: "For STITCHING, must be FLATLOCK, OVERLOCK, LOCK_STITCH, or IRON when provided"
 *     responses:
 *       201:
 *         description: Created operation
 */
router.get("/operations", validate(operationListQuerySchema, "query"), controller.list);
router.post("/operations", requireAdmin, validate(operationCreateSchema), controller.create);

/**
 * @openapi
 * /api/masters/operations/{id}/status:
 *   patch:
 *     tags: [Masters - Operations]
 *     summary: Toggle operation active status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated operation
 */
router.patch(
  "/operations/:id/status",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(operationStatusSchema),
  controller.updateStatus
);

/**
 * @openapi
 * /api/masters/operations/{id}:
 *   get:
 *     tags: [Masters - Operations]
 *     summary: Get operation by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Operation
 *   put:
 *     tags: [Masters - Operations]
 *     summary: Update operation. Rate changes are logged and do not affect pending payments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               stage: { type: string, enum: [CUTTING, PRINTING, COLORING, STITCHING, FINISHING] }
 *               ratePerPiece: { type: number, minimum: 0 }
 *               unit: { type: string }
 *               lotNo: { type: string }
 *               department: { type: string }
 *               departmentType:
 *                 type: string
 *                 enum: [FLATLOCK, OVERLOCK, LOCK_STITCH, IRON, CUTTING_MACHINE, PRINTING_MACHINE, COLORING_MACHINE, OTHER]
 *     responses:
 *       200:
 *         description: Updated operation, with note if rate changed
 */
router.get("/operations/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/operations/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(operationUpdateSchema),
  controller.update
);

/**
 * @openapi
 * /api/masters/operations/{id}:
 *   delete:
 *     tags: [Masters - Operations]
 *     summary: Permanently delete an operation
 *     description: Admin only. Fails if the operation is used in production or payments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Operation deleted
 *       409:
 *         description: Operation linked to existing transactions
 */
router.delete(
  "/operations/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  controller.remove
);

export default router;
