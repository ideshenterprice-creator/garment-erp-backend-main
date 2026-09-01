import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../src/app";

function signRole(role: "ADMIN" | "TEAM_MEMBER"): string | null {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;
  return jwt.sign(
    {
      userId: "00000000-0000-4000-8000-000000000001",
      email: "rbac@example.com",
      role,
    },
    secret,
    { expiresIn: "15m" }
  );
}

describe("Team", () => {
  it("requires auth for members list", async () => {
    const res = await request(app).get("/api/team/members");
    expect(res.status).toBe(401);
  });

  it("requires auth for invite", async () => {
    const res = await request(app).post("/api/team/invite").send({
      name: "Test User",
      email: "invitee@example.com",
      role: "TEAM_MEMBER",
    });
    expect(res.status).toBe(401);
  });

  it("rejects TEAM_MEMBER tokens on admin team routes", async () => {
    const token = signRole("TEAM_MEMBER");
    if (!token) return;
    const res = await request(app)
      .get("/api/team/members")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
