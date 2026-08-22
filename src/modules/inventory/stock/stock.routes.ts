import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./stock.controller";
import {
  productIdParamsSchema,
  stockAdjustSchema,
  stockHistoryQuerySchema,
  stockListQuerySchema,
} from "./stock.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/inventory/stock:
 *   get:
 *     tags: [Inventory - Stock]
 *     summary: List current stock with status flags
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [RAW_MATERIAL, FINISHED_GOOD, ACCESSORY, WASTAGE] }
 *       - in: query
 *         name: lowStock
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit } with stockStatus"
 */
router.get("/", validate(stockListQuerySchema, "query"), controller.list);

/**
 * @openapi
 * /api/inventory/stock/{productId}/history:
 *   get:
 *     tags: [Inventory - Stock]
 *     summary: Paginated stock transaction history for a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: transactionType
 *         schema: { type: string, enum: [PURCHASE_IN, ISSUE_OUT, PRODUCTION_IN, ADJUSTMENT, WASTAGE_IN, SALE_OUT] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Transaction history
 */
router.get(
  "/:productId/history",
  validate(productIdParamsSchema, "params"),
  validate(stockHistoryQuerySchema, "query"),
  controller.history
);

/**
 * @openapi
 * /api/inventory/stock/{productId}/adjust:
 *   post:
 *     tags: [Inventory - Stock]
 *     summary: Manual stock adjustment (admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adjustmentType, quantity, reason]
 *             properties:
 *               adjustmentType: { type: string, enum: [ADD, REDUCE] }
 *               quantity: { type: number }
 *               reason: { type: string, enum: [PHYSICAL_COUNT_CORRECTION, DAMAGED, SAMPLE_USED, OTHER] }
 *               notes: { type: string }
 *               date: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Updated stock
 *       400:
 *         description: Reduce exceeds available stock
 */
router.post(
  "/:productId/adjust",
  requireAdmin,
  validate(productIdParamsSchema, "params"),
  validate(stockAdjustSchema),
  controller.adjust
);

/**
 * @openapi
 * /api/inventory/stock/{productId}:
 *   get:
 *     tags: [Inventory - Stock]
 *     summary: Get stock for a product plus last 10 transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stock detail
 *       404:
 *         description: Not found
 */
router.get("/:productId", validate(productIdParamsSchema, "params"), controller.getByProduct);

export default router;
