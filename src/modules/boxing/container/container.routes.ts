import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./container.controller";
import {
  addBoxSchema,
  containerCreateSchema,
  containerListQuerySchema,
  dispatchSchema,
  idParamsSchema,
} from "./container.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/boxing/containers:
 *   get:
 *     tags: [Boxing - Container]
 *     summary: List containers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated containers with box counts
 *   post:
 *     tags: [Boxing - Container]
 *     summary: Create a loading container
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [poId, destination]
 *     responses:
 *       201:
 *         description: Created
 */
router.get("/", validate(containerListQuerySchema, "query"), controller.list);
router.post("/", requireAdmin, validate(containerCreateSchema), controller.create);

/**
 * @openapi
 * /api/boxing/containers/{id}/add-box:
 *   patch:
 *     tags: [Boxing - Container]
 *     summary: Load a packed box into a container
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated container
 */
router.patch(
  "/:id/add-box",
  validate(idParamsSchema, "params"),
  validate(addBoxSchema),
  controller.addBox
);

/**
 * @openapi
 * /api/boxing/containers/{id}/mark-ready:
 *   patch:
 *     tags: [Boxing - Container]
 *     summary: Mark container ready for dispatch
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Ready
 */
router.patch("/:id/mark-ready", requireAdmin, validate(idParamsSchema, "params"), controller.markReady);

/**
 * @openapi
 * /api/boxing/containers/{id}/mark-dispatched:
 *   patch:
 *     tags: [Boxing - Container]
 *     summary: Dispatch a ready container
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dispatched
 */
router.patch(
  "/:id/mark-dispatched",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(dispatchSchema),
  controller.markDispatched
);

/**
 * @openapi
 * /api/boxing/containers/{id}:
 *   get:
 *     tags: [Boxing - Container]
 *     summary: Get container with boxes and size totals
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Container
 */
router.get("/:id", validate(idParamsSchema, "params"), controller.getById);

export default router;
