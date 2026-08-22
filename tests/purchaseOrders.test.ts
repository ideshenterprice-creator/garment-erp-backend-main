import request from "supertest";
import app from "../src/app";

describe("Purchase orders", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/purchase-orders");
    expect(res.status).toBe(401);
  });
});
