import request from "supertest";
import app from "../src/app";

describe("Sales", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/sales");
    expect(res.status).toBe(401);
  });
});
