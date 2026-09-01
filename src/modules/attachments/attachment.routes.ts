import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./attachment.controller";
import { attachmentIdParamsSchema, attachmentListQuerySchema } from "./attachment.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

/**
 * @openapi
 * /api/attachments:
 *   get:
 *     tags: [Attachments]
 *     summary: List file metadata for an ERP entity
 *     security:
 *       - bearerAuth: []
 */
router.get("/", validate(attachmentListQuerySchema, "query"), controller.list);

/**
 * @openapi
 * /api/attachments/{id}/url:
 *   get:
 *     tags: [Attachments]
 *     summary: Create a short-lived signed URL for a private file
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id/url", validate(attachmentIdParamsSchema, "params"), controller.signedUrl);

export default router;
