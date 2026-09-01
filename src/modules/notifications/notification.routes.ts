import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./notification.controller";
import { notificationIdParamsSchema, notificationListQuerySchema } from "./notification.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications for the current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated notifications
 *       401:
 *         description: Unauthenticated
 */
router.get("/", validate(notificationListQuerySchema, "query"), controller.list);

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Unread notification count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 */
router.get("/unread-count", controller.unread);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated count
 */
router.patch("/read-all", controller.markAllRead);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark one notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated notification
 *       404:
 *         description: Not found
 */
router.patch(
  "/:id/read",
  validate(notificationIdParamsSchema, "params"),
  controller.markRead
);

/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete("/:id", validate(notificationIdParamsSchema, "params"), controller.remove);

export default router;
