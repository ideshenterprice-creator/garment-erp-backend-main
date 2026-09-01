import request from "supertest";
import app from "../src/app";

describe("Boxing", () => {
  it("requires auth for boxes", async () => {
    const res = await request(app).get("/api/boxing/boxes");
    expect(res.status).toBe(401);
  });
});
