import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./karigarPayment.controller";
import { idParamsSchema, karigarConfirmSchema, karigarListQuerySchema } from "./karigarPayment.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/accounts/karigar-payments:
 *   get:
 *     tags: [Accounts - Karigar Payments]
 *     summary: List karigar payments with weekly due summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: karigarId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PAID] }
 *       - in: query
 *         name: weekNumber
 *         schema: { type: integer }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated payments
 */
router.get("/", validate(karigarListQuerySchema, "query"), controller.list);

/**
 * @openapi
 * /api/accounts/karigar-payments/{id}/confirm:
 *   patch:
 *     tags: [Accounts - Karigar Payments]
 *     summary: Confirm a pending karigar payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paid
 */
router.patch(
  "/:id/confirm",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(karigarConfirmSchema),
  controller.confirm
);

/**
 * @openapi
 * /api/accounts/karigar-payments/{id}:
 *   get:
 *     tags: [Accounts - Karigar Payments]
 *     summary: Get karigar payment
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);

export default router;
