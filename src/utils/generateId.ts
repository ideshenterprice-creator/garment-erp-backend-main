import { PrismaClient } from "@prisma/client";

async function nextSeq(
  _prisma: PrismaClient,
  modelCount: () => Promise<number>,
  prefix: string,
  pad = 3
): Promise<string> {
  const count = await modelCount();
  return `${prefix}${String(count + 1).padStart(pad, "0")}`;
}

export async function generatePONumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PO-${year}-`;
  const count = await prisma.purchaseOrder.count({
    where: { poNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generatePBNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.purchaseBill.count(), "PB-");
}

export async function generateIssueNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `ISS-${year}-`;
  const count = await prisma.issueRecord.count({
    where: { issueNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generateBundleNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `BND-${year}-`;
  const count = await prisma.bundle.count({
    where: { bundleNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generateBoxNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.boxPacking.count(), "BOX-");
}

export async function generateContainerNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.container.count(), "CTN-");
}

export async function generateInvoiceNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const count = await prisma.salesBill.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generateVoucherNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.voucher.count(), "VCH-");
}

export async function generateKPNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.karigarPayment.count(), "KP-");
}

export async function generatePartyNumber(prisma: PrismaClient): Promise<string> {
  return nextSeq(prisma, () => prisma.party.count(), "PTY-");
}

export async function generateWastageNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `WST-${year}-`;
  const count = await prisma.cuttingWastage.count({
    where: { wastageNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generateNoteNumber(prisma: PrismaClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `CDN-${year}-`;
  const count = await prisma.creditDebitNote.count({
    where: { noteNumber: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export async function generateEntryNumber(
  prisma: PrismaClient,
  stage: "CUT" | "PRT" | "CLR" | "STH" | "FIN"
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `${stage}-${year}-`;
  let count = 0;
  if (stage === "CUT") {
    count = await prisma.cuttingEntry.count({ where: { entryNumber: { startsWith: prefix } } });
  } else if (stage === "PRT") {
    count = await prisma.printingEntry.count({ where: { entryNumber: { startsWith: prefix } } });
  } else if (stage === "CLR") {
    count = await prisma.coloringEntry.count({ where: { entryNumber: { startsWith: prefix } } });
  } else if (stage === "STH") {
    count = await prisma.stitchingEntry.count({ where: { entryNumber: { startsWith: prefix } } });
  } else {
    count = await prisma.finishingEntry.count({ where: { entryNumber: { startsWith: prefix } } });
  }
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
