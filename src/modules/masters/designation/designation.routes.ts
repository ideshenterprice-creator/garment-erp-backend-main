import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { requireAdmin, requireTeamMember } from "@/middleware/roleCheck";
import { validate } from "@/middleware/validate";
import * as controller from "./designation.controller";
import {
  designationCreateSchema,
  designationListQuerySchema,
  designationStatusSchema,
  designationUpdateSchema,
  idParamsSchema,
} from "./designation.schema";

const router = Router();
router.use(authenticate, requireTeamMember);

router.get(
  "/designations",
  validate(designationListQuerySchema, "query"),
  controller.list
);
router.post(
  "/designations",
  requireAdmin,
  validate(designationCreateSchema),
  controller.create
);
router.get(
  "/designations/:id",
  validate(idParamsSchema, "params"),
  controller.getById
);
router.put(
  "/designations/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(designationUpdateSchema),
  controller.update
);
router.patch(
  "/designations/:id/status",
  requireAdmin,
  validate(idParamsSchema, "params"),
  validate(designationStatusSchema),
  controller.updateStatus
);
router.delete(
  "/designations/:id",
  requireAdmin,
  validate(idParamsSchema, "params"),
  controller.remove
);

export default router;
