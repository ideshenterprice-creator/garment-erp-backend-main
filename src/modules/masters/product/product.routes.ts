import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./product.controller";
import {
  idParamsSchema,
  productCreateSchema,
  productListQuerySchema,
  productStatusSchema,
  productUpdateSchema,
} from "./product.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/masters/products:
 *   get:
 *     tags: [Masters - Product]
 *     summary: List products (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [RAW_MATERIAL, FINISHED_GOOD, ACCESSORY, WASTAGE] }
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
 *         description: "{ data, total, page, limit }. FINISHED_GOOD includes sizes."
 *   post:
 *     tags: [Masters - Product]
 *     summary: Create a product, sizes (if finished good), and zero stock
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, unit, gstRate]
 *             properties:
 *               name: { type: string, minLength: 2 }
 *               category: { type: string, enum: [RAW_MATERIAL, FINISHED_GOOD, ACCESSORY, WASTAGE] }
 *               unit: { type: string, enum: [KG, PCS, METERS, ROLLS] }
 *               gstRate: { type: number, minimum: 0, maximum: 100 }
 *               description: { type: string }
 *               sizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [SIZE_0_3M, SIZE_3_6M, SIZE_6_9M, SIZE_9_12M, SIZE_12_18M, SIZE_18_24M]
 *     responses:
 *       201:
 *         description: Created product
 */
router.get("/products", validate(productListQuerySchema, "query"), controller.list);
router.post("/products", requireAdmin, validate(productCreateSchema), controller.create);

/**
 * @openapi
 * /api/masters/products/{id}/status:
 *   patch:
 *     tags: [Masters - Product]
 *     summary: Toggle product active status
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
 *         description: Updated product
 */
router.patch(
  "/products/:id/status",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(productStatusSchema),
  controller.updateStatus
);

/**
 * @openapi
 * /api/masters/products/{id}:
 *   get:
 *     tags: [Masters - Product]
 *     summary: Get product by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product
 *       404:
 *         description: Not found
 *   put:
 *     tags: [Masters - Product]
 *     summary: Update a product and replace sizes when provided
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated product
 */
router.get("/products/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/products/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(productUpdateSchema),
  controller.update
);

/**
 * @openapi
 * /api/masters/products/{id}:
 *   delete:
 *     tags: [Masters - Product]
 *     summary: Permanently delete a product
 *     description: Admin only. Fails if the product is linked to stock movement or transactions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Product deleted
 *       409:
 *         description: Product linked to existing transactions
 */
router.delete(
  "/products/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  controller.remove
);

export default router;
