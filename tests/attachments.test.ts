import request from "supertest";
import app from "../src/app";

describe("Attachments", () => {
  it("requires auth to list attachments", async () => {
    const res = await request(app).get("/api/attachments").query({
      entityType: "SALES_BILL",
      entityId: "00000000-0000-4000-8000-000000000099",
    });
    expect(res.status).toBe(401);
  });

  it("requires auth for signed URLs", async () => {
    const res = await request(app).get(
      "/api/attachments/00000000-0000-4000-8000-000000000099/url"
    );
    expect(res.status).toBe(401);
  });
});
