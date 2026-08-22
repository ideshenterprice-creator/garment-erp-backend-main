import request from "supertest";
import app from "../src/app";

describe("Accounts", () => {
  it("requires auth for ledger", async () => {
    const res = await request(app).get("/api/ledger");
    expect(res.status).toBe(401);
  });
});
