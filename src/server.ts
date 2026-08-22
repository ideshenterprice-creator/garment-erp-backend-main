import dotenv from "dotenv";
dotenv.config();

import app from "@/app";
import prisma from "@/config/database";
import logger from "@/config/logger";

const port = Number(process.env.PORT ?? 5000);

async function start(): Promise<void> {
  await prisma.$connect();
  logger.info("Prisma connected");

  const server = app.listen(port, () => {
    logger.info(`FabricFlow ERP API listening on http://localhost:${port}`);
    logger.info(`Swagger UI: http://localhost:${port}/api/docs`);
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
