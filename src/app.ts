import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "@/config/swagger";
import { errorHandler } from "@/middleware/errorHandler";
import authRoutes from "@/modules/auth/auth.routes";
import teamRoutes from "@/modules/team/team.routes";
import partyRoutes from "@/modules/masters/party/party.routes";
import productRoutes from "@/modules/masters/product/product.routes";
import operationsRoutes from "@/modules/masters/operations/operations.routes";
import gstRoutes from "@/modules/masters/gst/gst.routes";
import karigarRoutes from "@/modules/masters/karigar/karigar.routes";
import poRoutes from "@/modules/purchaseOrders/po.routes";
import purchaseRoutes from "@/modules/purchase/purchase.routes";
import stockRoutes from "@/modules/inventory/stock/stock.routes";
import issueRoutes from "@/modules/inventory/issue/issue.routes";
import wastageRoutes from "@/modules/inventory/wastage/wastage.routes";
import cuttingRoutes from "@/modules/production/cutting/cutting.routes";
import printingRoutes from "@/modules/production/printing/printing.routes";
import coloringRoutes from "@/modules/production/coloring/coloring.routes";
import stitchingRoutes from "@/modules/production/stitching/stitching.routes";
import finishingRoutes from "@/modules/production/finishing/finishing.routes";
import bundleRoutes from "@/modules/production/bundle/bundle.routes";
import boxRoutes from "@/modules/boxing/box/box.routes";
import containerRoutes from "@/modules/boxing/container/container.routes";
import salesRoutes, { salesRegisterRouter } from "@/modules/sales/bills/sales.routes";
import notesRoutes from "@/modules/sales/notes/notes.routes";
import karigarPaymentRoutes from "@/modules/accounts/karigarPayments/karigarPayment.routes";
import supplierPaymentRoutes from "@/modules/accounts/supplierPayments/supplierPayment.routes";
import voucherRoutes from "@/modules/accounts/vouchers/voucher.routes";
import ledgerRoutes from "@/modules/accounts/ledger/ledger.routes";
import statementRoutes from "@/modules/accounts/statement/statement.routes";

const app: Application = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check
 *     security: []
 *     responses:
 *       200:
 *         description: Service is up
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/masters", partyRoutes);
app.use("/api/masters", productRoutes);
app.use("/api/masters", operationsRoutes);
app.use("/api/masters", gstRoutes);
app.use("/api/masters", karigarRoutes);
app.use("/api/purchase-orders", poRoutes);
app.use("/api/purchase", purchaseRoutes);
app.use("/api/inventory/stock", stockRoutes);
app.use("/api/inventory/issues", issueRoutes);
app.use("/api/inventory/wastage", wastageRoutes);
app.use("/api/production/cutting", cuttingRoutes);
app.use("/api/production/printing", printingRoutes);
app.use("/api/production/coloring", coloringRoutes);
app.use("/api/production/stitching", stitchingRoutes);
app.use("/api/production/finishing", finishingRoutes);
app.use("/api/production/bundles", bundleRoutes);
app.use("/api/boxing/boxes", boxRoutes);
app.use("/api/boxing/containers", containerRoutes);
app.use("/api/sales/bills", salesRoutes);
app.use("/api/sales", salesRegisterRouter);
app.use("/api/sales/notes", notesRoutes);
app.use("/api/accounts/karigar-payments", karigarPaymentRoutes);
app.use("/api/accounts/supplier-payments", supplierPaymentRoutes);
app.use("/api/accounts/vouchers", voucherRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/accounts/statement", statementRoutes);

app.use(errorHandler);

export default app;
