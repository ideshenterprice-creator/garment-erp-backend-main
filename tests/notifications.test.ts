import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../src/app";

function signTeamToken(): string | null {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      userId: "00000000-0000-4000-8000-000000000002",
      email: "member@example.com",
      role: "TEAM_MEMBER",
    },
    secret,
    { expiresIn: "15m" }
  );
}

describe("Notifications", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });

  it("requires auth for unread count", async () => {
    const res = await request(app).get("/api/notifications/unread-count");
    expect(res.status).toBe(401);
  });

  it("rejects invalid notification ids", async () => {
    const token = signTeamToken();
    if (!token) return;
    const res = await request(app)
      .patch("/api/notifications/not-a-uuid/read")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe("Search", () => {
  it("requires auth", async () => {
    const res = await request(app).get("/api/search").query({ q: "cotton" });
    expect(res.status).toBe(401);
  });

  it("rejects short queries", async () => {
    const token = signTeamToken();
    if (!token) return;
    const res = await request(app)
      .get("/api/search")
      .query({ q: "a" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
