import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./sales.controller";
import {
  idParamsSchema,
  salesCreateSchema,
  salesListQuerySchema,
  salesPaymentSchema,
  salesRegisterQuerySchema,
  salesReturnSchema,
} from "./sales.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/sales/bills:
 *   get:
 *     tags: [Sales - Bills]
 *     summary: List sales bills with monthly summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, SUBMITTED, PAID, RETURNED] }
 *       - in: query
 *         name: buyerId
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
 *         description: Paginated bills
 *   post:
 *     tags: [Sales - Bills]
 *     summary: Create a draft sales bill
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [poId, invoiceDate, items]
 *     responses:
 *       201:
 *         description: Draft bill
 */
router.get("/", validate(salesListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(salesCreateSchema), controller.create);

/**
 * @openapi
 * /api/sales/bills/{id}/submit:
 *   patch:
 *     tags: [Sales - Bills]
 *     summary: Submit draft bill and debit buyer ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Submitted
 */
router.patch("/:id/submit", requireAdmin, validate(idParamsSchema, "params"), controller.submit);

/**
 * @openapi
 * /api/sales/bills/{id}/record-payment:
 *   patch:
 *     tags: [Sales - Bills]
 *     summary: Record a receipt against a submitted bill
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment recorded
 */
router.patch(
  "/:id/record-payment",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(salesPaymentSchema),
  controller.recordPayment
);

/**
 * @openapi
 * /api/sales/bills/{id}/return:
 *   patch:
 *     tags: [Sales - Bills]
 *     summary: Mark bill returned and reverse ledger
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Returned
 */
router.patch(
  "/:id/return",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(salesReturnSchema),
  controller.markReturned
);

/**
 * @openapi
 * /api/sales/bills/{id}/pdf:
 *   get:
 *     tags: [Sales - Bills]
 *     summary: Download a server-generated sales bill PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/:id/pdf", validate(idParamsSchema, "params"), controller.invoicePdf);

/**
 * @openapi
 * /api/sales/bills/{id}:
 *   get:
 *     tags: [Sales - Bills]
 *     summary: Get sales bill with items and payment status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bill
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);

export const salesRegisterRouter = Router();
salesRegisterRouter.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/sales/register/export:
 *   get:
 *     tags: [Sales - Bills]
 *     summary: Export sales register as CSV
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
 *         name: buyerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CSV file
 */
salesRegisterRouter.get(
  "/register/export",
  validate(salesRegisterQuerySchema, "query"),
  controller.registerExport
);

/**
 * @openapi
 * /api/sales/register:
 *   get:
 *     tags: [Sales - Bills]
 *     summary: Sales register for a date range
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
 *         name: buyerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Register
 */
salesRegisterRouter.get("/register", validate(salesRegisterQuerySchema, "query"), controller.register);

export default router;
