import request from "supertest";
import app from "../src/app";
import {
  parseDurationMs,
  corsAllowlist,
  isAllowedCorsOrigin,
  isFabricFlowVercelOrigin,
  backendUrl,
} from "../src/config/env";

describe("Auth", () => {
  it("health check returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("database health does not leak connection details", async () => {
    const res = await request(app).get("/health/db");
    expect([200, 503]).toContain(res.status);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/postgresql:\/\//i);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/DATABASE_URL/i);
    expect(body).not.toMatch(/DIRECT_URL/i);
  });

  it("storage health does not leak credentials", async () => {
    const res = await request(app).get("/health/storage");
    expect([200, 503]).toContain(res.status);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/service_role/i);
    expect(body).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/i);
  });

  it("rejects invalid login payload", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for missing bearer token on /me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("parses refresh cookie TTL from duration strings", () => {
    expect(parseDurationMs("7d", 0)).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDurationMs("15m", 0)).toBe(15 * 60 * 1000);
    expect(parseDurationMs("bogus", 42)).toBe(42);
  });

  it("allows the production Vercel frontend origin", () => {
    expect(corsAllowlist()).toContain("https://garment-erp-frontend-ivory.vercel.app");
    expect(corsAllowlist()).toContain("https://garment-erp-frontend-main-ebon.vercel.app");
  });

  it("allows local frontend origin so Railway can be used from localhost", () => {
    expect(corsAllowlist()).toContain("http://localhost:3000");
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(isAllowedCorsOrigin("http://localhost:3000")).toBe(true);
    process.env.NODE_ENV = previous;
  });

  it("allows FabricFlow Vercel preview origins", () => {
    expect(
      isFabricFlowVercelOrigin("https://garment-erp-frontend-main-hwizpqxz0-idesh.vercel.app")
    ).toBe(true);
    expect(
      isFabricFlowVercelOrigin("https://garment-erp-frontend-main-ebon.vercel.app")
    ).toBe(true);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(
      isAllowedCorsOrigin("https://garment-erp-frontend-main-ebon.vercel.app")
    ).toBe(true);
    process.env.NODE_ENV = previous;
  });

  it("uses Railway public domain when BACKEND_URL is unset", () => {
    const previousBackend = process.env.BACKEND_URL;
    const previousRailway = process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.BACKEND_URL;
    process.env.RAILWAY_PUBLIC_DOMAIN = "chic-presence.up.railway.app";
    expect(backendUrl()).toBe("https://chic-presence.up.railway.app");
    if (previousBackend === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = previousBackend;
    }
    if (previousRailway === undefined) {
      delete process.env.RAILWAY_PUBLIC_DOMAIN;
    } else {
      process.env.RAILWAY_PUBLIC_DOMAIN = previousRailway;
    }
  });

  it("allows localhost on alternate ports in development", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(isAllowedCorsOrigin("http://localhost:3002")).toBe(true);
    process.env.NODE_ENV = "production";
    expect(isAllowedCorsOrigin("http://localhost:3002")).toBe(false);
    process.env.NODE_ENV = previous;
  });
});
