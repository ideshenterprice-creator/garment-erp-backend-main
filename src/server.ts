import dotenv from "dotenv";
dotenv.config();

import app from "@/app";
import prisma from "@/config/database";
import logger from "@/config/logger";
import { isProduction } from "@/config/env";
import { ensurePrivateBucket } from "@/services/storage/supabase-storage.service";

const port = Number(process.env.PORT ?? 5000);
const host = process.env.HOST ?? "0.0.0.0";

function assertDatabaseConfig(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
  if (isProduction() && /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL)) {
    throw new Error("Production backend must not connect to a localhost database");
  }
}

async function start(): Promise<void> {
  assertDatabaseConfig();
  await prisma.$connect();
  logger.info("Prisma connected");
  await ensurePrivateBucket();

  const server = app.listen(port, host, () => {
    logger.info("FabricFlow ERP API listening", { host, port });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

start().catch((err: unknown) => {
  logger.error(err);
  process.exit(1);
});
