-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PAYMENT', 'STATUS_CHANGE', 'ASSIGN_OPERATION', 'PRODUCTION_ENTRY', 'LOGIN', 'LOGOUT');

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- AlterTable
ALTER TABLE "KarigarPayment" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "KarigarProfile" ADD COLUMN     "designationId" TEXT;

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarPaymentTransaction" (
    "id" TEXT NOT NULL,
    "karigarPaymentId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMPTZ(6) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KarigarPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_code_key" ON "Designation"("code");

-- CreateIndex
CREATE INDEX "Designation_isActive_idx" ON "Designation"("isActive");

-- CreateIndex
CREATE INDEX "Designation_name_idx" ON "Designation"("name");

-- CreateIndex
CREATE INDEX "KarigarPaymentTransaction_karigarPaymentId_idx" ON "KarigarPaymentTransaction"("karigarPaymentId");

-- CreateIndex
CREATE INDEX "KarigarPaymentTransaction_karigarId_idx" ON "KarigarPaymentTransaction"("karigarId");

-- CreateIndex
CREATE INDEX "KarigarPaymentTransaction_paymentDate_idx" ON "KarigarPaymentTransaction"("paymentDate");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "KarigarProfile_designationId_idx" ON "KarigarProfile"("designationId");

-- AddForeignKey
ALTER TABLE "KarigarProfile" ADD CONSTRAINT "KarigarProfile_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPaymentTransaction" ADD CONSTRAINT "KarigarPaymentTransaction_karigarPaymentId_fkey" FOREIGN KEY ("karigarPaymentId") REFERENCES "KarigarPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPaymentTransaction" ADD CONSTRAINT "KarigarPaymentTransaction_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPaymentTransaction" ADD CONSTRAINT "KarigarPaymentTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill paid amounts for existing fully paid karigar payments
UPDATE "KarigarPayment"
SET "amountPaid" = "amountDue"
WHERE "status" = 'PAID';

-- Seed default karigar designations
INSERT INTO "Designation" ("id", "code", "name", "description", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'CUTTER', 'Cutter', 'Fabric and pattern cutting', true, NOW(), NOW()),
  (gen_random_uuid(), 'STITCHER', 'Stitcher', 'Garment stitching', true, NOW(), NOW()),
  (gen_random_uuid(), 'OVERLOCK', 'Overlock', 'Overlock machine operator', true, NOW(), NOW()),
  (gen_random_uuid(), 'FLATLOCK', 'Flatlock', 'Flatlock machine operator', true, NOW(), NOW()),
  (gen_random_uuid(), 'FINISHER', 'Finisher', 'Finishing operations', true, NOW(), NOW()),
  (gen_random_uuid(), 'IRONING', 'Ironing', 'Ironing and pressing', true, NOW(), NOW()),
  (gen_random_uuid(), 'PACKING', 'Packing', 'Packing and boxing', true, NOW(), NOW()),
  (gen_random_uuid(), 'HELPER', 'Helper', 'General helper', true, NOW(), NOW()),
  (gen_random_uuid(), 'SUPERVISOR', 'Supervisor', 'Floor supervisor', true, NOW(), NOW()),
  (gen_random_uuid(), 'OTHER', 'Other', 'Other designation', true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
