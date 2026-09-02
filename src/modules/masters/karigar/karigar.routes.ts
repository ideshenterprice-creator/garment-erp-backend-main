import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./karigar.controller";
import {
  idParamsSchema,
  karigarCreateSchema,
  karigarListQuerySchema,
  karigarPaymentsQuerySchema,
  karigarStatusSchema,
  karigarUpdateSchema,
} from "./karigar.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/masters/karigars:
 *   get:
 *     tags: [Masters - Karigar]
 *     summary: List karigar profiles (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: paymentType
 *         schema: { type: string, enum: [PIECE_RATE, WEEKLY_SALARY, BOTH] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit } with party and operations"
 *   post:
 *     tags: [Masters - Karigar]
 *     summary: Create a karigar profile linked to a KARIGAR party
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partyId, paymentType]
 *             properties:
 *               partyId: { type: string, format: uuid }
 *               paymentType: { type: string, enum: [PIECE_RATE, WEEKLY_SALARY, BOTH] }
 *               weeklySalary: { type: number }
 *               operationIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Created profile
 */
router.get("/karigars", validate(karigarListQuerySchema, "query"), controller.list);
router.post("/karigars", requireAdmin, validate(karigarCreateSchema), controller.create);

/**
 * @openapi
 * /api/masters/karigars/{id}/payments:
 *   get:
 *     tags: [Masters - Karigar]
 *     summary: List payment history for a karigar profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PAID] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: "{ data, total, page, limit }"
 */
router.get(
  "/karigars/:id/payments",
  validate(idParamsSchema, "params"),
  validate(karigarPaymentsQuerySchema, "query"),
  controller.listPayments
);

/**
 * @openapi
 * /api/masters/karigars/{id}/status:
 *   patch:
 *     tags: [Masters - Karigar]
 *     summary: Toggle karigar profile active status
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
 *         description: Updated profile
 */
router.patch(
  "/karigars/:id/status",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(karigarStatusSchema),
  controller.updateStatus
);

/**
 * @openapi
 * /api/masters/karigars/{id}:
 *   get:
 *     tags: [Masters - Karigar]
 *     summary: Get full karigar profile
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Profile with party and operations
 *       404:
 *         description: Not found
 *   put:
 *     tags: [Masters - Karigar]
 *     summary: Update karigar profile and replace assigned operations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.get("/karigars/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/karigars/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(karigarUpdateSchema),
  controller.update
);

/**
 * @openapi
 * /api/masters/karigars/{id}:
 *   delete:
 *     tags: [Masters - Karigar]
 *     summary: Permanently delete a karigar profile and linked party
 *     description: Admin only. Fails if the karigar is linked to production or payments.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Karigar deleted
 *       409:
 *         description: Karigar linked to existing transactions
 */
router.delete(
  "/karigars/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  controller.remove
);

export default router;
