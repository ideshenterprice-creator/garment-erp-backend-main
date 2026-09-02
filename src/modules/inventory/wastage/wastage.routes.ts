import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./wastage.controller";
import { idParamsSchema, wastageCreateSchema, wastageListQuerySchema } from "./wastage.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/inventory/wastage:
 *   get:
 *     tags: [Inventory - Wastage]
 *     summary: List cutting wastage (paginated) with kg summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [IN_STOCK, SOLD] }
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
 *     tags: [Inventory - Wastage]
 *     summary: Record cutting wastage returned to wastage stock
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [poId, designCode, fabricProductId, wastageQty, returnedByPartyId, dateOfReturn]
 *     responses:
 *       201:
 *         description: Created wastage (CW-001...)
 */
router.get("/", validate(wastageListQuerySchema, "query"), controller.list);
router.post("/", validate(wastageCreateSchema), controller.create);

/**
 * @openapi
 * /api/inventory/wastage/{id}/mark-sold:
 *   patch:
 *     tags: [Inventory - Wastage]
 *     summary: Mark wastage as sold and decrement wastage stock
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated wastage
 *       400:
 *         description: Already sold or insufficient stock
 */
router.patch("/:id/mark-sold", requireAdmin, validate(idParamsSchema, "params"), controller.markSold);

/**
 * @openapi
 * /api/inventory/wastage/{id}:
 *   get:
 *     tags: [Inventory - Wastage]
 *     summary: Get a wastage record
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Wastage
 *       404:
 *         description: Not found
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);
router.delete("/:id", requireAdmin, validate(idParamsSchema, "params"), controller.remove);

export default router;
