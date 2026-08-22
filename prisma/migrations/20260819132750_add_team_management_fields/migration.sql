-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "inviteTokenExpiry" TIMESTAMP(3),
ALTER COLUMN "isActive" SET DEFAULT false;
