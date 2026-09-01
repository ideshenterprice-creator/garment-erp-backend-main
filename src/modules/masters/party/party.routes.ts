import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./party.controller";
import {
  idParamsSchema,
  partyCreateSchema,
  partyListQuerySchema,
  partyStatusSchema,
  partyUpdateSchema,
} from "./party.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/masters/parties:
 *   get:
 *     tags: [Masters - Party]
 *     summary: List parties (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [BUYER, SUPPLIER, KARIGAR] }
 *       - in: query
 *         name: isActive
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
 *         description: "{ data, total, page, limit }"
 *   post:
 *     tags: [Masters - Party]
 *     summary: Create a party
 *     description: Admin only. Auto-generates BUY-001 / SUP-001 / KAR-001.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               type: { type: string, enum: [BUYER, SUPPLIER, KARIGAR] }
 *               contact: { type: string }
 *               gstNumber: { type: string }
 *               city: { type: string }
 *               country: { type: string }
 *               bankAccount: { type: string }
 *               ifsc: { type: string }
 *               bankName: { type: string }
 *     responses:
 *       201:
 *         description: Created party
 *       400:
 *         description: Name and type combination already exists
 *       403:
 *         description: Admin access required
 */
router.get("/parties", validate(partyListQuerySchema, "query"), controller.list);
router.post("/parties", requireAdmin, validate(partyCreateSchema), controller.create);

/**
 * @openapi
 * /api/masters/parties/{id}/status:
 *   patch:
 *     tags: [Masters - Party]
 *     summary: Toggle party active status
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
 *         description: Updated party
 */
router.patch(
  "/parties/:id/status",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(partyStatusSchema),
  controller.updateStatus
);

/**
 * @openapi
 * /api/masters/parties/{id}:
 *   get:
 *     tags: [Masters - Party]
 *     summary: Get party by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Party
 *       404:
 *         description: Not found
 *   put:
 *     tags: [Masters - Party]
 *     summary: Update a party
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
 *     responses:
 *       200:
 *         description: Updated party
 */
router.get("/parties/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/parties/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(partyUpdateSchema),
  controller.update
);

/**
 * @openapi
 * /api/masters/parties/{id}:
 *   delete:
 *     tags: [Masters - Party]
 *     summary: Permanently delete a party
 *     description: Admin only. Fails if the party is linked to transactions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Party deleted
 *       409:
 *         description: Party linked to existing transactions
 */
router.delete(
  "/parties/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  controller.remove
);

export default router;
