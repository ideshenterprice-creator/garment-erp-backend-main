import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../src/config/database";
import { adminCredentials } from "../src/config/adminCredentials";

const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const { email, password, name } = adminCredentials();
  const aliases = (process.env.ADMIN_EMAIL_ALIASES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
  const emails = [...new Set([email, ...aliases])];
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  for (const accountEmail of emails) {
    await prisma.user.upsert({
      where: { email: accountEmail },
      update: {
        name,
        password: passwordHash,
        role: "ADMIN",
        isActive: true,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
      create: {
        name,
        email: accountEmail,
        password: passwordHash,
        role: "ADMIN",
        isActive: true,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });
  }

  console.log(`Admin account is ready for ${emails.length} email(s) (password not logged).`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed to upsert admin");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
