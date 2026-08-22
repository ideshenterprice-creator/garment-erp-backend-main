import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./supplierPayment.controller";
import {
  idParamsSchema,
  supplierPaymentCreateSchema,
  supplierPaymentListQuerySchema,
} from "./supplierPayment.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/accounts/supplier-payments:
 *   get:
 *     tags: [Accounts - Supplier Payments]
 *     summary: List purchase bills with computed payment status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: supplierId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PAID, PARTIAL, UNPAID] }
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
 *         description: Bills with PAID, PARTIAL, or UNPAID
 *   post:
 *     tags: [Accounts - Supplier Payments]
 *     summary: Record a supplier payment against a confirmed bill
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purchaseBillId, amountPaid, paymentDate, paymentMode]
 *     responses:
 *       201:
 *         description: Created
 */
router.get("/", validate(supplierPaymentListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(supplierPaymentCreateSchema), controller.create);

/**
 * @openapi
 * /api/accounts/supplier-payments/{id}:
 *   get:
 *     tags: [Accounts - Supplier Payments]
 *     summary: Get purchase bill payment history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bill with payments
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);

export default router;
