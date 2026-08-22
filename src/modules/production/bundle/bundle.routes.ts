import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./bundle.controller";
import { bundleListQuerySchema, bundleNumberParamsSchema } from "./bundle.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/production/bundles:
 *   get:
 *     tags: [Production - Bundle]
 *     summary: List production bundles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: poId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: currentStage
 *         schema: { type: string, enum: [CUTTING, PRINTING, COLORING, STITCHING, FINISHING, BOXING, COMPLETED] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [IN_PROGRESS, COMPLETED] }
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
router.get("/", validate(bundleListQuerySchema, "query"), controller.list);

/**
 * @openapi
 * /api/production/bundles/{bundleNumber}/journey:
 *   get:
 *     tags: [Production - Bundle]
 *     summary: Full stage-by-stage journey for a bundle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bundleNumber
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stage journey
 */
router.get(
  "/:bundleNumber/journey",
  validate(bundleNumberParamsSchema, "params"),
  controller.journey
);

/**
 * @openapi
 * /api/production/bundles/{bundleNumber}/payments:
 *   get:
 *     tags: [Production - Bundle]
 *     summary: Karigar payments generated for this bundle
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bundleNumber
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payments plus totalPaymentForBundle
 */
router.get(
  "/:bundleNumber/payments",
  validate(bundleNumberParamsSchema, "params"),
  controller.payments
);

/**
 * @openapi
 * /api/production/bundles/{bundleNumber}:
 *   get:
 *     tags: [Production - Bundle]
 *     summary: Get bundle summary by bundleNumber
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bundleNumber
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bundle summary
 *       404:
 *         description: Not found
 */
router.get("/:bundleNumber", validate(bundleNumberParamsSchema, "params"), controller.getByNumber);

export default router;
