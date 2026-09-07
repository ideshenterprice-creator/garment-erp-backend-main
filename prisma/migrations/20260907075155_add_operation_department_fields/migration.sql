-- CreateEnum
CREATE TYPE "OperationDepartment" AS ENUM ('FLATLOCK', 'OVERLOCK', 'LOCK_STITCH', 'IRON', 'CUTTING_MACHINE', 'PRINTING_MACHINE', 'COLORING_MACHINE', 'OTHER');

-- AlterTable
ALTER TABLE "Operation" ADD COLUMN     "department" TEXT,
ADD COLUMN     "departmentType" "OperationDepartment",
ADD COLUMN     "lotNo" TEXT;

-- CreateIndex
CREATE INDEX "Operation_departmentType_idx" ON "Operation"("departmentType");
