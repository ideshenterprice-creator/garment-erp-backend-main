import request from "supertest";
import app from "../src/app";

describe("Inventory", () => {
  it("requires auth for stock", async () => {
    const res = await request(app).get("/api/inventory/stock");
    expect(res.status).toBe(401);
  });

  it("requires auth for issues", async () => {
    const res = await request(app).get("/api/inventory/issues");
    expect(res.status).toBe(401);
  });
});
