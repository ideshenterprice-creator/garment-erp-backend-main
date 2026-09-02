import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./voucher.controller";
import { idParamsSchema, voucherCreateSchema, voucherListQuerySchema } from "./voucher.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/accounts/vouchers:
 *   get:
 *     tags: [Accounts - Vouchers]
 *     summary: List payment and receipt vouchers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [PAYMENT, RECEIPT] }
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
 *         description: Paginated vouchers
 *   post:
 *     tags: [Accounts - Vouchers]
 *     summary: Create a payment or receipt voucher
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, partyDescription, amount, paymentMode, date]
 *     responses:
 *       201:
 *         description: Created
 */
router.get("/", validate(voucherListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(voucherCreateSchema), controller.create);

/**
 * @openapi
 * /api/accounts/vouchers/{id}:
 *   get:
 *     tags: [Accounts - Vouchers]
 *     summary: Get voucher
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Voucher
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
