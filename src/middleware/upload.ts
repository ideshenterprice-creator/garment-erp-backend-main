import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "@/middleware/errorHandler";

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const PRODUCT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const productImageMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() ?? "").toLowerCase();
    const allowedExt = ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp";
    if (!PRODUCT_IMAGE_MIME_TYPES.has(file.mimetype) && !allowedExt) {
      cb(new AppError("Only JPEG, PNG, and WebP images are allowed", 400, "INVALID_FILE"));
      return;
    }
    if (file.mimetype === "image/jpg") {
      file.mimetype = "image/jpeg";
    }
    cb(null, true);
  },
});

export function productImageUpload(req: Request, res: Response, next: NextFunction): void {
  productImageMulter.single("image")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(new AppError("Image must be 5MB or smaller", 400, "INVALID_FILE"));
        return;
      }
      next(new AppError("Invalid image upload", 400, "INVALID_FILE"));
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}
