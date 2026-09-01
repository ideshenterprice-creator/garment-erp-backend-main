import request from "supertest";
import app from "../src/app";

describe("Purchase", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/purchase/bills");
    expect(res.status).toBe(401);
  });
});
