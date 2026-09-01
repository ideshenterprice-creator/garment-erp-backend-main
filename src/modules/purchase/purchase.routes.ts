import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./purchase.controller";
import {
  idParamsSchema,
  purchaseCreateSchema,
  purchaseListQuerySchema,
  purchaseRegisterQuerySchema,
  purchaseReturnSchema,
} from "./purchase.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/purchase/bills:
 *   get:
 *     tags: [Purchase]
 *     summary: List purchase bills (paginated) with monthly summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, RETURNED] }
 *       - in: query
 *         name: supplierId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: poId
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
 *     tags: [Purchase]
 *     summary: Create a PENDING purchase bill (stock is not updated yet)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, supplierInvoiceNo, purchaseDate, poId, productId, grossWeight, tareWeight, ratePerKg]
 *             properties:
 *               supplierId: { type: string, format: uuid }
 *               supplierInvoiceNo: { type: string }
 *               purchaseDate: { type: string, format: date }
 *               poId: { type: string, format: uuid }
 *               productId: { type: string, format: uuid }
 *               vehicleNumber: { type: string }
 *               grossWeight: { type: number }
 *               tareWeight: { type: number }
 *               ratePerKg: { type: number }
 *     responses:
 *       201:
 *         description: Created pending bill
 *       403:
 *         description: Admin access required
 */
router.get("/bills", validate(purchaseListQuerySchema, "query"), controller.list);
router.post("/bills", requireAdmin, validate(purchaseCreateSchema), controller.create);

/**
 * @openapi
 * /api/purchase/register:
 *   get:
 *     tags: [Purchase]
 *     summary: Purchase register report for a date range
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: supplierId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: fabricType
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Register rows, summary, and totals
 */
router.get("/register/export", validate(purchaseRegisterQuerySchema, "query"), controller.registerExport);
router.get("/register", validate(purchaseRegisterQuerySchema, "query"), controller.register);

/**
 * @openapi
 * /api/purchase/bills/{id}/confirm:
 *   patch:
 *     tags: [Purchase]
 *     summary: Confirm a pending bill — stock in + supplier ledger credit in one transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Confirmed bill with stock update info
 *       400:
 *         description: Already confirmed/returned or duplicate invoice
 */
router.patch("/bills/:id/confirm", requireAdmin, validate(idParamsSchema, "params"), controller.confirm);

/**
 * @openapi
 * /api/purchase/bills/{id}/return:
 *   patch:
 *     tags: [Purchase]
 *     summary: Return a purchase bill and reverse stock/ledger if it was confirmed
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
 *         description: Returned bill
 */
router.patch(
  "/bills/:id/return",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(purchaseReturnSchema),
  controller.markReturned
);

/**
 * @openapi
 * /api/purchase/bills/{id}:
 *   get:
 *     tags: [Purchase]
 *     summary: Get full purchase bill with stock update and payment history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bill detail
 *       404:
 *         description: Not found
 */
router.get("/bills/:id", validate(idParamsSchema, "params"), controller.getById);

export default router;
