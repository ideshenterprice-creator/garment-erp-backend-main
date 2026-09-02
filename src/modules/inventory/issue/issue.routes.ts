import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./issue.controller";
import { idParamsSchema, issueCreateSchema, issueListQuerySchema, issueReturnSchema } from "./issue.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/inventory/issues:
 *   get:
 *     tags: [Inventory - Issue]
 *     summary: List fabric/material issues (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: issueType
 *         schema: { type: string, enum: [CUTTING, PRINTING, STITCHING, FINISHING, SAMPLE, PATTERN] }
 *       - in: query
 *         name: karigarId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ISSUED, RETURNED, PARTIAL] }
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
 *         description: "{ data, total, page, limit }"
 *   post:
 *     tags: [Inventory - Issue]
 *     summary: Issue stock to a karigar and create a production bundle
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [issueDate, issueType, productId, poId, poItemId, karigarId, quantityIssued]
 *     responses:
 *       201:
 *         description: Created issue. Response includes bundleNumber.
 *       400:
 *         description: Insufficient stock or invalid references
 */
router.get("/", validate(issueListQuerySchema, "query"), controller.list);
router.post("/", validate(issueCreateSchema), controller.create);

/**
 * @openapi
 * /api/inventory/issues/{id}/return:
 *   patch:
 *     tags: [Inventory - Issue]
 *     summary: Record a full or partial issue return and restore stock
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
 *             required: [quantityReturned]
 *             properties:
 *               quantityReturned: { type: number }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Updated issue
 */
router.patch(
  "/:id/return",
  validate(idParamsSchema, "params"),
  validate(issueReturnSchema),
  controller.markReturned
);

/**
 * @openapi
 * /api/inventory/issues/{id}:
 *   get:
 *     tags: [Inventory - Issue]
 *     summary: Get issue detail including bundle stage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Issue
 *       404:
 *         description: Not found
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
