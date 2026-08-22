import request from "supertest";
import app from "../src/app";

describe("Production", () => {
  it("requires auth for cutting", async () => {
    const res = await request(app).get("/api/production/cutting");
    expect(res.status).toBe(401);
  });

  it("requires auth for bundles", async () => {
    const res = await request(app).get("/api/bundles");
    expect(res.status).toBe(401);
  });
});
