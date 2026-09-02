import request from "supertest";
import app from "../src/app";

describe("Masters", () => {
  it("requires auth for parties", async () => {
    const res = await request(app).get("/api/masters/parties");
    expect(res.status).toBe(401);
  });

  it("requires auth for products", async () => {
    const res = await request(app).get("/api/masters/products");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a party", async () => {
    const res = await request(app).delete("/api/masters/parties/00000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a product", async () => {
    const res = await request(app).delete("/api/masters/products/00000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete an operation", async () => {
    const res = await request(app).delete("/api/masters/operations/00000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a GST rate", async () => {
    const res = await request(app).delete("/api/masters/gst/00000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a karigar", async () => {
    const res = await request(app).delete("/api/masters/karigars/00000000-0000-4000-8000-000000000001");
    expect(res.status).toBe(401);
  });
});
