import request from "supertest";
import app from "../src/app";

describe("Sales", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/sales/bills");
    expect(res.status).toBe(401);
  });
});
