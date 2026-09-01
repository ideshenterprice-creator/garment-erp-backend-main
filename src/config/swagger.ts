import swaggerJsdoc from "swagger-jsdoc";
import fs from "fs";
import path from "path";
import { backendUrl } from "@/config/env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FabricFlow ERP API",
      version: "1.0.0",
      description:
        "Backend API for FabricFlow ERP — garment manufacturing (masters, purchase, inventory, production, boxing, sales, accounts, team, notifications).",
    },
    servers: [
      {
        url: backendUrl(),
        description: process.env.NODE_ENV === "production" ? "Production" : "Local development",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/modules/**/*.routes.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

if (require.main === module) {
  const out = path.join(process.cwd(), "swagger.json");
  fs.writeFileSync(out, JSON.stringify(swaggerSpec, null, 2), "utf8");
  console.log(`Swagger spec written to ${out}`);
}

export default swaggerSpec;
