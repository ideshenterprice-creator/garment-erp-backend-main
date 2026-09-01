-- Non-destructive production migration:
-- 1. Notification + FileAttachment tables
-- 2. Search indexes
-- 3. Enable RLS on ERP tables so Supabase Data API (anon/authenticated)
--    cannot read or write rows. Prisma connects as the table owner and
--    continues to bypass RLS.

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_bucket_objectPath_key" ON "FileAttachment"("bucket", "objectPath");

-- CreateIndex
CREATE INDEX "FileAttachment_entityType_entityId_idx" ON "FileAttachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "FileAttachment_uploadedById_idx" ON "FileAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Party_gstNumber_idx" ON "Party"("gstNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Party_partyNumber_idx" ON "Party"("partyNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GSTRate_applicableOn_idx" ON "GSTRate"("applicableOn");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS (no policies for anon/authenticated = Data API denied)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Party" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductSize" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Operation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GSTRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FileAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KarigarProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KarigarOperation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "POItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IssueRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CuttingWastage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bundle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CuttingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrintingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ColoringEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StitchingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinishingEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KarigarPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BoxPacking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Container" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesBillItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditDebitNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SupplierPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Voucher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;
