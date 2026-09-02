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

  it("requires auth to upload a product image", async () => {
    const res = await request(app)
      .post("/api/masters/products/00000000-0000-4000-8000-000000000001/image")
      .attach("image", Buffer.from("fake"), { filename: "photo.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(401);
  });

  it("requires auth to request a product image upload URL", async () => {
    const res = await request(app)
      .post("/api/masters/products/00000000-0000-4000-8000-000000000001/image/upload-url")
      .send({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 12 });
    expect(res.status).toBe(401);
  });

  it("requires auth to confirm a product image upload", async () => {
    const res = await request(app)
      .post("/api/masters/products/00000000-0000-4000-8000-000000000001/image/confirm")
      .send({
        objectPath: "products/00000000-0000-4000-8000-000000000001/photo.jpg",
        originalName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 12,
      });
    expect(res.status).toBe(401);
  });

  it("requires auth to delete a product image", async () => {
    const res = await request(app).delete(
      "/api/masters/products/00000000-0000-4000-8000-000000000001/image"
    );
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
