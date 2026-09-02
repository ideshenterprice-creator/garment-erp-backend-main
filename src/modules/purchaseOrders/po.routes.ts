import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./po.controller";
import {
  idParamsSchema,
  poCancelSchema,
  poCreateSchema,
  poListQuerySchema,
  poUpdateSchema,
} from "./po.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/purchase-orders:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: List purchase orders (paginated) with status summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, IN_PRODUCTION, READY_TO_SHIP, COMPLETED, CANCELLED] }
 *       - in: query
 *         name: buyerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string, description: Search poNumber or buyerPoReference }
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
 *     tags: [Purchase Orders]
 *     summary: Create a purchase order with size-wise items
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [buyerId, buyerPoReference, orderDate, deliveryDate, shippingDestination, paymentTerms, items]
 *             properties:
 *               buyerId: { type: string, format: uuid }
 *               buyerPoReference: { type: string }
 *               orderDate: { type: string, format: date }
 *               deliveryDate: { type: string, format: date }
 *               shippingDestination: { type: string }
 *               paymentTerms: { type: string }
 *               specialInstructions: { type: string }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [designNumber, garmentType, color]
 *     responses:
 *       201:
 *         description: Created PO with items
 *       403:
 *         description: Admin access required
 */
router.get("/", validate(poListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(poCreateSchema), controller.create);

/**
 * @openapi
 * /api/purchase-orders/{id}/production-status:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: Quick production progress view for a PO
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage issued/completed/pending/status
 *       404:
 *         description: PO not found
 */
router.get(
  "/:id/production-status",
  validate(idParamsSchema, "params"),
  controller.productionStatus
);

/**
 * @openapi
 * /api/purchase-orders/{id}/fabric-lots:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: List purchase bills (fabric lots) linked to a PO
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lots plus totalFabricReceived from CONFIRMED bills
 */
router.get("/:id/fabric-lots", validate(idParamsSchema, "params"), controller.fabricLots);

/**
 * @openapi
 * /api/purchase-orders/{id}/cancel:
 *   patch:
 *     tags: [Purchase Orders]
 *     summary: Cancel a purchase order (soft cancel, never deleted)
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: PO cancelled
 *       400:
 *         description: Already cancelled or completed
 */
router.patch(
  "/:id/cancel",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(poCancelSchema),
  controller.cancel
);

/**
 * @openapi
 * /api/purchase-orders/{id}:
 *   get:
 *     tags: [Purchase Orders]
 *     summary: Get full PO detail including items, production progress, and fabric lots
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Full PO
 *       404:
 *         description: Not found
 *   put:
 *     tags: [Purchase Orders]
 *     summary: Update a PO and replace items when provided
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated PO
 *       400:
 *         description: Cannot edit completed or cancelled PO
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(poUpdateSchema),
  controller.update
);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
