import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import prisma from "../src/config/database";
import { adminCredentials } from "../src/config/adminCredentials";

const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const { email, password, name } = adminCredentials();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email },
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
      email,
      password: passwordHash,
      role: "ADMIN",
      isActive: true,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  console.log("Admin account is ready from .env (password not logged).");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Failed to upsert admin");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
