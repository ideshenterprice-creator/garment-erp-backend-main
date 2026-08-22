import request from "supertest";
import app from "../src/app";

describe("Masters", () => {
  it("requires auth for parties", async () => {
    const res = await request(app).get("/api/parties");
    expect(res.status).toBe(401);
  });

  it("requires auth for products", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });
});
