-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEAM_MEMBER');

-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('BUYER', 'SUPPLIER', 'KARIGAR');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('RAW_MATERIAL', 'FINISHED_GOOD', 'ACCESSORY', 'WASTAGE');

-- CreateEnum
CREATE TYPE "UnitOfMeasure" AS ENUM ('KG', 'PCS', 'METERS', 'ROLLS');

-- CreateEnum
CREATE TYPE "SizeLabel" AS ENUM ('SIZE_0_3M', 'SIZE_3_6M', 'SIZE_6_9M', 'SIZE_9_12M', 'SIZE_12_18M', 'SIZE_18_24M');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('CUTTING', 'PRINTING', 'COLORING', 'STITCHING', 'FINISHING');

-- CreateEnum
CREATE TYPE "BundleStage" AS ENUM ('CUTTING', 'PRINTING', 'COLORING', 'STITCHING', 'FINISHING', 'BOXING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('ZERO_RATED', 'IGST', 'CGST_SGST');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PIECE_RATE', 'WEEKLY_SALARY', 'BOTH');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('ACTIVE', 'IN_PRODUCTION', 'READY_TO_SHIP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseBillStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RETURNED');

-- CreateEnum
CREATE TYPE "StockTransactionType" AS ENUM ('PURCHASE_IN', 'ISSUE_OUT', 'PRODUCTION_IN', 'ADJUSTMENT', 'WASTAGE_IN', 'SALE_OUT');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('CUTTING', 'PRINTING', 'STITCHING', 'FINISHING', 'SAMPLE', 'PATTERN');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "WastageStatus" AS ENUM ('IN_STOCK', 'SOLD');

-- CreateEnum
CREATE TYPE "BundleStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductionEntryType" AS ENUM ('CUTTING', 'PRINTING', 'COLORING', 'STITCHING', 'FINISHING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "BoxStatus" AS ENUM ('PACKED', 'LOADED');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('LOADING', 'READY', 'DISPATCHED');

-- CreateEnum
CREATE TYPE "SalesBillStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PAID', 'RETURNED');

-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('PAYMENT', 'RECEIPT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TEAM_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "partyNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartyType" NOT NULL,
    "contact" TEXT,
    "gstNumber" TEXT,
    "city" TEXT,
    "country" TEXT,
    "bankAccount" TEXT,
    "ifsc" TEXT,
    "bankName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sizeLabel" "SizeLabel" NOT NULL,

    CONSTRAINT "ProductSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "ratePerPiece" DECIMAL(12,2) NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'PCS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Operation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GSTRate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gstPercent" DECIMAL(5,2) NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "applicableOn" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GSTRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarProfile" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "weeklySalary" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "KarigarProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarOperation" (
    "id" TEXT NOT NULL,
    "karigarProfileId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,

    CONSTRAINT "KarigarOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "buyerPoReference" TEXT,
    "orderDate" TIMESTAMPTZ(6) NOT NULL,
    "deliveryDate" TIMESTAMPTZ(6) NOT NULL,
    "shippingDestination" TEXT,
    "paymentTerms" TEXT,
    "specialInstructions" TEXT,
    "status" "POStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "totalDesigns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "designNumber" TEXT NOT NULL,
    "garmentType" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "qty_0_3M" INTEGER NOT NULL DEFAULT 0,
    "qty_3_6M" INTEGER NOT NULL DEFAULT 0,
    "qty_6_9M" INTEGER NOT NULL DEFAULT 0,
    "qty_9_12M" INTEGER NOT NULL DEFAULT 0,
    "qty_12_18M" INTEGER NOT NULL DEFAULT 0,
    "qty_18_24M" INTEGER NOT NULL DEFAULT 0,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "POItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseBill" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierInvoiceNo" TEXT,
    "purchaseDate" TIMESTAMPTZ(6) NOT NULL,
    "poId" TEXT,
    "productId" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "grossWeight" DECIMAL(12,3) NOT NULL,
    "tareWeight" DECIMAL(12,3) NOT NULL,
    "netWeight" DECIMAL(12,3) NOT NULL,
    "ratePerKg" DECIMAL(12,2) NOT NULL,
    "gstPercent" DECIMAL(5,2) NOT NULL,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "PurchaseBillStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PurchaseBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "lastUpdated" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionType" "StockTransactionType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueRecord" (
    "id" TEXT NOT NULL,
    "issueNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMPTZ(6) NOT NULL,
    "issueType" "IssueType" NOT NULL,
    "productId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "poItemId" TEXT,
    "karigarId" TEXT NOT NULL,
    "quantityIssued" DECIMAL(14,3) NOT NULL,
    "bundleNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IssueRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingWastage" (
    "id" TEXT NOT NULL,
    "wastageNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "designCode" TEXT NOT NULL,
    "fabricTypeId" TEXT NOT NULL,
    "wastageQty" DECIMAL(14,3) NOT NULL,
    "returnedById" TEXT NOT NULL,
    "dateOfReturn" TIMESTAMPTZ(6) NOT NULL,
    "remarks" TEXT,
    "status" "WastageStatus" NOT NULL DEFAULT 'IN_STOCK',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CuttingWastage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL,
    "bundleNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "poItemId" TEXT,
    "issueId" TEXT,
    "currentStage" "BundleStage" NOT NULL DEFAULT 'CUTTING',
    "status" "BundleStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "poItemId" TEXT,
    "karigarId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "fabricIssuedKg" DECIMAL(14,3) NOT NULL,
    "totalPiecesCut" INTEGER NOT NULL,
    "qty_0_3M" INTEGER NOT NULL DEFAULT 0,
    "qty_3_6M" INTEGER NOT NULL DEFAULT 0,
    "qty_6_9M" INTEGER NOT NULL DEFAULT 0,
    "qty_9_12M" INTEGER NOT NULL DEFAULT 0,
    "qty_12_18M" INTEGER NOT NULL DEFAULT 0,
    "qty_18_24M" INTEGER NOT NULL DEFAULT 0,
    "wastageKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CuttingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintingEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "piecesReceived" INTEGER NOT NULL,
    "piecesReturned" INTEGER NOT NULL,
    "piecesRejected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PrintingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColoringEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "colorApplied" TEXT NOT NULL,
    "piecesReceived" INTEGER NOT NULL,
    "piecesReturned" INTEGER NOT NULL,
    "piecesRejected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ColoringEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StitchingEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "piecesGiven" INTEGER NOT NULL,
    "piecesReturned" INTEGER NOT NULL,
    "piecesRejected" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "StitchingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishingEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "piecesReceived" INTEGER NOT NULL,
    "piecesCompleted" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FinishingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KarigarPayment" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "poId" TEXT,
    "operationId" TEXT NOT NULL,
    "productionEntryType" "ProductionEntryType" NOT NULL,
    "productionEntryId" TEXT NOT NULL,
    "piecesCompleted" INTEGER NOT NULL,
    "ratePerPiece" DECIMAL(12,2) NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ(6),
    "paymentMode" TEXT,
    "referenceNo" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "KarigarPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoxPacking" (
    "id" TEXT NOT NULL,
    "boxNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "poItemId" TEXT,
    "designNumber" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "qty_0_3M" INTEGER NOT NULL DEFAULT 0,
    "qty_3_6M" INTEGER NOT NULL DEFAULT 0,
    "qty_6_9M" INTEGER NOT NULL DEFAULT 0,
    "qty_9_12M" INTEGER NOT NULL DEFAULT 0,
    "qty_12_18M" INTEGER NOT NULL DEFAULT 0,
    "qty_18_24M" INTEGER NOT NULL DEFAULT 0,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "containerId" TEXT,
    "status" "BoxStatus" NOT NULL DEFAULT 'PACKED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BoxPacking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dispatchDate" TIMESTAMPTZ(6),
    "status" "ContainerStatus" NOT NULL DEFAULT 'LOADING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBill" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "containerId" TEXT,
    "invoiceDate" TIMESTAMPTZ(6) NOT NULL,
    "buyerPoReference" TEXT,
    "paymentTerms" TEXT,
    "shippingDestination" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(12,6) NOT NULL,
    "subTotal" DECIMAL(12,2) NOT NULL,
    "gstAmount" DECIMAL(12,2) NOT NULL,
    "netTotal" DECIMAL(12,2) NOT NULL,
    "status" "SalesBillStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SalesBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBillItem" (
    "id" TEXT NOT NULL,
    "salesBillId" TEXT NOT NULL,
    "poItemId" TEXT,
    "designNumber" TEXT NOT NULL,
    "garmentType" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "ratePerPiece" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SalesBillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditDebitNote" (
    "id" TEXT NOT NULL,
    "noteNumber" TEXT NOT NULL,
    "type" "NoteType" NOT NULL,
    "salesBillId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "CreditDebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "purchaseBillId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMPTZ(6) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "partyDescription" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "referenceNo" TEXT,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ(6) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "debitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Party_partyNumber_key" ON "Party"("partyNumber");

-- CreateIndex
CREATE INDEX "Party_type_idx" ON "Party"("type");

-- CreateIndex
CREATE INDEX "Party_name_idx" ON "Party"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "ProductSize_productId_idx" ON "ProductSize"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSize_productId_sizeLabel_key" ON "ProductSize"("productId", "sizeLabel");

-- CreateIndex
CREATE UNIQUE INDEX "Operation_operationCode_key" ON "Operation"("operationCode");

-- CreateIndex
CREATE INDEX "Operation_stage_idx" ON "Operation"("stage");

-- CreateIndex
CREATE INDEX "GSTRate_category_idx" ON "GSTRate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "KarigarProfile_partyId_key" ON "KarigarProfile"("partyId");

-- CreateIndex
CREATE INDEX "KarigarProfile_paymentType_idx" ON "KarigarProfile"("paymentType");

-- CreateIndex
CREATE INDEX "KarigarOperation_operationId_idx" ON "KarigarOperation"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "KarigarOperation_karigarProfileId_operationId_key" ON "KarigarOperation"("karigarProfileId", "operationId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_buyerId_idx" ON "PurchaseOrder"("buyerId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_idx" ON "PurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_orderDate_idx" ON "PurchaseOrder"("orderDate");

-- CreateIndex
CREATE INDEX "POItem_poId_idx" ON "POItem"("poId");

-- CreateIndex
CREATE INDEX "POItem_designNumber_idx" ON "POItem"("designNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseBill_billNumber_key" ON "PurchaseBill"("billNumber");

-- CreateIndex
CREATE INDEX "PurchaseBill_supplierId_idx" ON "PurchaseBill"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseBill_productId_idx" ON "PurchaseBill"("productId");

-- CreateIndex
CREATE INDEX "PurchaseBill_status_idx" ON "PurchaseBill"("status");

-- CreateIndex
CREATE INDEX "PurchaseBill_purchaseDate_idx" ON "PurchaseBill"("purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_productId_key" ON "Stock"("productId");

-- CreateIndex
CREATE INDEX "Stock_productId_idx" ON "Stock"("productId");

-- CreateIndex
CREATE INDEX "StockTransaction_productId_idx" ON "StockTransaction"("productId");

-- CreateIndex
CREATE INDEX "StockTransaction_referenceType_referenceId_idx" ON "StockTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "StockTransaction_createdAt_idx" ON "StockTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IssueRecord_issueNumber_key" ON "IssueRecord"("issueNumber");

-- CreateIndex
CREATE INDEX "IssueRecord_productId_idx" ON "IssueRecord"("productId");

-- CreateIndex
CREATE INDEX "IssueRecord_poId_idx" ON "IssueRecord"("poId");

-- CreateIndex
CREATE INDEX "IssueRecord_karigarId_idx" ON "IssueRecord"("karigarId");

-- CreateIndex
CREATE INDEX "IssueRecord_issueDate_idx" ON "IssueRecord"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingWastage_wastageNumber_key" ON "CuttingWastage"("wastageNumber");

-- CreateIndex
CREATE INDEX "CuttingWastage_poId_idx" ON "CuttingWastage"("poId");

-- CreateIndex
CREATE INDEX "CuttingWastage_status_idx" ON "CuttingWastage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_bundleNumber_key" ON "Bundle"("bundleNumber");

-- CreateIndex
CREATE INDEX "Bundle_poId_idx" ON "Bundle"("poId");

-- CreateIndex
CREATE INDEX "Bundle_currentStage_idx" ON "Bundle"("currentStage");

-- CreateIndex
CREATE INDEX "Bundle_status_idx" ON "Bundle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CuttingEntry_entryNumber_key" ON "CuttingEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "CuttingEntry_bundleId_idx" ON "CuttingEntry"("bundleId");

-- CreateIndex
CREATE INDEX "CuttingEntry_poId_idx" ON "CuttingEntry"("poId");

-- CreateIndex
CREATE INDEX "CuttingEntry_karigarId_idx" ON "CuttingEntry"("karigarId");

-- CreateIndex
CREATE UNIQUE INDEX "PrintingEntry_entryNumber_key" ON "PrintingEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "PrintingEntry_bundleId_idx" ON "PrintingEntry"("bundleId");

-- CreateIndex
CREATE INDEX "PrintingEntry_poId_idx" ON "PrintingEntry"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "ColoringEntry_entryNumber_key" ON "ColoringEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "ColoringEntry_bundleId_idx" ON "ColoringEntry"("bundleId");

-- CreateIndex
CREATE INDEX "ColoringEntry_poId_idx" ON "ColoringEntry"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "StitchingEntry_entryNumber_key" ON "StitchingEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "StitchingEntry_bundleId_idx" ON "StitchingEntry"("bundleId");

-- CreateIndex
CREATE INDEX "StitchingEntry_operationId_idx" ON "StitchingEntry"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "FinishingEntry_entryNumber_key" ON "FinishingEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "FinishingEntry_bundleId_idx" ON "FinishingEntry"("bundleId");

-- CreateIndex
CREATE INDEX "FinishingEntry_operationId_idx" ON "FinishingEntry"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "KarigarPayment_paymentNumber_key" ON "KarigarPayment"("paymentNumber");

-- CreateIndex
CREATE INDEX "KarigarPayment_karigarId_idx" ON "KarigarPayment"("karigarId");

-- CreateIndex
CREATE INDEX "KarigarPayment_status_idx" ON "KarigarPayment"("status");

-- CreateIndex
CREATE INDEX "KarigarPayment_year_weekNumber_idx" ON "KarigarPayment"("year", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BoxPacking_boxNumber_key" ON "BoxPacking"("boxNumber");

-- CreateIndex
CREATE INDEX "BoxPacking_poId_idx" ON "BoxPacking"("poId");

-- CreateIndex
CREATE INDEX "BoxPacking_containerId_idx" ON "BoxPacking"("containerId");

-- CreateIndex
CREATE INDEX "BoxPacking_status_idx" ON "BoxPacking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Container_containerNumber_key" ON "Container"("containerNumber");

-- CreateIndex
CREATE INDEX "Container_poId_idx" ON "Container"("poId");

-- CreateIndex
CREATE INDEX "Container_buyerId_idx" ON "Container"("buyerId");

-- CreateIndex
CREATE INDEX "Container_status_idx" ON "Container"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesBill_invoiceNumber_key" ON "SalesBill"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SalesBill_poId_idx" ON "SalesBill"("poId");

-- CreateIndex
CREATE INDEX "SalesBill_buyerId_idx" ON "SalesBill"("buyerId");

-- CreateIndex
CREATE INDEX "SalesBill_status_idx" ON "SalesBill"("status");

-- CreateIndex
CREATE INDEX "SalesBillItem_salesBillId_idx" ON "SalesBillItem"("salesBillId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditDebitNote_noteNumber_key" ON "CreditDebitNote"("noteNumber");

-- CreateIndex
CREATE INDEX "CreditDebitNote_salesBillId_idx" ON "CreditDebitNote"("salesBillId");

-- CreateIndex
CREATE INDEX "CreditDebitNote_buyerId_idx" ON "CreditDebitNote"("buyerId");

-- CreateIndex
CREATE INDEX "SupplierPayment_purchaseBillId_idx" ON "SupplierPayment"("purchaseBillId");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherNumber_key" ON "Voucher"("voucherNumber");

-- CreateIndex
CREATE INDEX "Voucher_type_idx" ON "Voucher"("type");

-- CreateIndex
CREATE INDEX "Voucher_date_idx" ON "Voucher"("date");

-- CreateIndex
CREATE INDEX "LedgerEntry_partyId_idx" ON "LedgerEntry"("partyId");

-- CreateIndex
CREATE INDEX "LedgerEntry_entryDate_idx" ON "LedgerEntry"("entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSize" ADD CONSTRAINT "ProductSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarProfile" ADD CONSTRAINT "KarigarProfile_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarOperation" ADD CONSTRAINT "KarigarOperation_karigarProfileId_fkey" FOREIGN KEY ("karigarProfileId") REFERENCES "KarigarProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarOperation" ADD CONSTRAINT "KarigarOperation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POItem" ADD CONSTRAINT "POItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseBill" ADD CONSTRAINT "PurchaseBill_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRecord" ADD CONSTRAINT "IssueRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRecord" ADD CONSTRAINT "IssueRecord_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRecord" ADD CONSTRAINT "IssueRecord_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "POItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRecord" ADD CONSTRAINT "IssueRecord_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueRecord" ADD CONSTRAINT "IssueRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingWastage" ADD CONSTRAINT "CuttingWastage_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingWastage" ADD CONSTRAINT "CuttingWastage_fabricTypeId_fkey" FOREIGN KEY ("fabricTypeId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingWastage" ADD CONSTRAINT "CuttingWastage_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "POItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "IssueRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingEntry" ADD CONSTRAINT "CuttingEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingEntry" ADD CONSTRAINT "CuttingEntry_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingEntry" ADD CONSTRAINT "CuttingEntry_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "POItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingEntry" ADD CONSTRAINT "CuttingEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintingEntry" ADD CONSTRAINT "PrintingEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintingEntry" ADD CONSTRAINT "PrintingEntry_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrintingEntry" ADD CONSTRAINT "PrintingEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColoringEntry" ADD CONSTRAINT "ColoringEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColoringEntry" ADD CONSTRAINT "ColoringEntry_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColoringEntry" ADD CONSTRAINT "ColoringEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StitchingEntry" ADD CONSTRAINT "StitchingEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StitchingEntry" ADD CONSTRAINT "StitchingEntry_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StitchingEntry" ADD CONSTRAINT "StitchingEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StitchingEntry" ADD CONSTRAINT "StitchingEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishingEntry" ADD CONSTRAINT "FinishingEntry_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishingEntry" ADD CONSTRAINT "FinishingEntry_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishingEntry" ADD CONSTRAINT "FinishingEntry_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishingEntry" ADD CONSTRAINT "FinishingEntry_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPayment" ADD CONSTRAINT "KarigarPayment_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPayment" ADD CONSTRAINT "KarigarPayment_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KarigarPayment" ADD CONSTRAINT "KarigarPayment_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxPacking" ADD CONSTRAINT "BoxPacking_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxPacking" ADD CONSTRAINT "BoxPacking_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "POItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoxPacking" ADD CONSTRAINT "BoxPacking_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBill" ADD CONSTRAINT "SalesBill_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBill" ADD CONSTRAINT "SalesBill_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBill" ADD CONSTRAINT "SalesBill_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillItem" ADD CONSTRAINT "SalesBillItem_salesBillId_fkey" FOREIGN KEY ("salesBillId") REFERENCES "SalesBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesBillItem" ADD CONSTRAINT "SalesBillItem_poItemId_fkey" FOREIGN KEY ("poItemId") REFERENCES "POItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_salesBillId_fkey" FOREIGN KEY ("salesBillId") REFERENCES "SalesBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditDebitNote" ADD CONSTRAINT "CreditDebitNote_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_purchaseBillId_fkey" FOREIGN KEY ("purchaseBillId") REFERENCES "PurchaseBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
