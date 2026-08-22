import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./gst.controller";
import { gstCreateSchema, gstUpdateSchema, idParamsSchema } from "./gst.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/masters/gst:
 *   get:
 *     tags: [Masters - GST]
 *     summary: List all GST rates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All GST rates
 *   post:
 *     tags: [Masters - GST]
 *     summary: Create a GST rate
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, gstPercent, taxType, applicableOn]
 *             properties:
 *               category: { type: string }
 *               gstPercent: { type: number, minimum: 0, maximum: 100 }
 *               taxType: { type: string, enum: [ZERO_RATED, IGST, CGST_SGST] }
 *               applicableOn: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Created GST rate
 *       400:
 *         description: Category already exists
 */
router.get("/gst", controller.list);
router.post("/gst", requireAdmin, validate(gstCreateSchema), controller.create);

/**
 * @openapi
 * /api/masters/gst/{id}:
 *   get:
 *     tags: [Masters - GST]
 *     summary: Get GST rate by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: GST rate
 *       404:
 *         description: Not found
 *   put:
 *     tags: [Masters - GST]
 *     summary: Update a GST rate
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated GST rate
 */
router.get("/gst/:id", validate(idParamsSchema, "params"), controller.getById);
router.put(
  "/gst/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(gstUpdateSchema),
  controller.update
);

export default router;
