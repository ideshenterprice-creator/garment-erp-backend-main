import swaggerJsdoc from "swagger-jsdoc";
import fs from "fs";
import path from "path";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FabricFlow ERP API",
      version: "1.0.0",
      description:
        "Backend API for FabricFlow ERP — baby garments export manufacturing (fabric, production, boxing, sales, accounts).",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT ?? "5000"}`,
        description: "Local development",
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
