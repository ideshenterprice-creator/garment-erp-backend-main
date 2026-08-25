import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type PartyType = "BUYER" | "SUPPLIER" | "KARIGAR";
type ProductCategory = "RAW_MATERIAL" | "FINISHED_GOOD" | "ACCESSORY" | "WASTAGE";
type UnitOfMeasure = "KG" | "PCS" | "METERS" | "ROLLS";
type ProductionStage = "CUTTING" | "PRINTING" | "COLORING" | "STITCHING" | "FINISHING";
type SizeLabel =
  | "SIZE_0_3M"
  | "SIZE_3_6M"
  | "SIZE_6_9M"
  | "SIZE_9_12M"
  | "SIZE_12_18M"
  | "SIZE_18_24M";

const partyIds = new Map<string, string>();
const productIds = new Map<string, string>();
const operationIds = new Map<string, string>();
const poIds = new Map<string, string>();
const poItemIds = new Map<string, string>();
const billIds = new Map<string, string>();
const bundleIds = new Map<string, string>();
const cuttingEntryIds = new Map<string, string>();
const printingEntryIds = new Map<string, string>();
const coloringEntryIds = new Map<string, string>();
const stitchingEntryIds = new Map<string, string>();
const finishingEntryIds = new Map<string, string>();
const containerIds = new Map<string, string>();
const boxIds = new Map<string, string>();
const salesBillIds = new Map<string, string>();

function d(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function date(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  return new Date(value);
}

async function upsertParty(input: {
  mockId: string;
  partyNumber: string;
  name: string;
  type: PartyType;
  contact?: string;
  gstNumber?: string;
  city?: string;
  country?: string;
  bankAccount?: string;
  ifsc?: string;
  bankName?: string;
  isActive?: boolean;
}): Promise<string> {
  const existingByNumber = await prisma.party.findUnique({
    where: { partyNumber: input.partyNumber },
  });
  const existingByNameType = await prisma.party.findFirst({
    where: { name: input.name, type: input.type },
  });
  const existing = existingByNumber ?? existingByNameType;

  const data = {
    partyNumber: input.partyNumber,
    name: input.name,
    type: input.type,
    contact: input.contact ?? null,
    gstNumber: input.gstNumber || null,
    city: input.city ?? null,
    country: input.country ?? null,
    bankAccount: input.bankAccount || null,
    ifsc: input.ifsc || null,
    bankName: input.bankName || null,
    isActive: input.isActive ?? true,
  };

  const party = existing
    ? await prisma.party.update({ where: { id: existing.id }, data })
    : await prisma.party.create({ data });

  partyIds.set(input.mockId, party.id);
  return party.id;
}

async function upsertProduct(input: {
  mockId: string;
  productCode: string;
  name: string;
  category: ProductCategory;
  unit: UnitOfMeasure;
  gstRate: number;
  description?: string;
  isActive?: boolean;
  sizes?: SizeLabel[];
  stockQty?: number;
}): Promise<string> {
  const existingByCode = await prisma.product.findUnique({
    where: { productCode: input.productCode },
  });
  const existingByNameCat = await prisma.product.findFirst({
    where: { name: input.name, category: input.category },
  });
  const existing = existingByCode ?? existingByNameCat;

  const data = {
    productCode: input.productCode,
    name: input.name,
    category: input.category,
    unit: input.unit,
    gstRate: d(input.gstRate),
    description: input.description ?? null,
    isActive: input.isActive ?? true,
  };

  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data })
    : await prisma.product.create({ data });

  if (input.sizes?.length) {
    for (const sizeLabel of input.sizes) {
      await prisma.productSize.upsert({
        where: {
          productId_sizeLabel: { productId: product.id, sizeLabel },
        },
        update: {},
        create: { productId: product.id, sizeLabel },
      });
    }
  }

  await prisma.stock.upsert({
    where: { productId: product.id },
    update: { quantity: d(input.stockQty ?? 0) },
    create: { productId: product.id, quantity: d(input.stockQty ?? 0) },
  });

  productIds.set(input.mockId, product.id);
  return product.id;
}

async function upsertOperation(input: {
  mockId: string;
  operationCode: string;
  name: string;
  stage: ProductionStage;
  ratePerPiece: number;
  unit?: UnitOfMeasure;
  isActive?: boolean;
}): Promise<string> {
  const existingByCode = await prisma.operation.findUnique({
    where: { operationCode: input.operationCode },
  });
  const existingByNameStage = await prisma.operation.findFirst({
    where: { name: input.name, stage: input.stage },
  });
  const existing = existingByCode ?? existingByNameStage;

  const data = {
    operationCode: input.operationCode,
    name: input.name,
    stage: input.stage,
    ratePerPiece: d(input.ratePerPiece),
    unit: input.unit ?? "PCS",
    isActive: input.isActive ?? true,
  };

  const operation = existing
    ? await prisma.operation.update({ where: { id: existing.id }, data })
    : await prisma.operation.create({ data });

  operationIds.set(input.mockId, operation.id);
  return operation.id;
}

async function ensureBundle(input: {
  bundleNumber: string;
  poMockId: string;
  poItemMockId?: string;
  issueId?: string;
  currentStage?:
    | "CUTTING"
    | "PRINTING"
    | "COLORING"
    | "STITCHING"
    | "FINISHING"
    | "BOXING"
    | "COMPLETED";
  status?: "IN_PROGRESS" | "COMPLETED";
}): Promise<string> {
  const existing = await prisma.bundle.findUnique({
    where: { bundleNumber: input.bundleNumber },
  });
  const poId = poIds.get(input.poMockId);
  if (!poId) {
    throw new Error(`PO ${input.poMockId} missing for bundle ${input.bundleNumber}`);
  }

  const data = {
    bundleNumber: input.bundleNumber,
    poId,
    poItemId: input.poItemMockId ? poItemIds.get(input.poItemMockId) ?? null : null,
    issueId: input.issueId ?? null,
    currentStage: input.currentStage ?? "CUTTING",
    status: input.status ?? "IN_PROGRESS",
  };

  const bundle = existing
    ? await prisma.bundle.update({ where: { id: existing.id }, data })
    : await prisma.bundle.create({ data });

  bundleIds.set(input.bundleNumber, bundle.id);
  return bundle.id;
}

async function upsertLedger(input: {
  partyId: string;
  entryDate: Date;
  description: string;
  referenceType: string;
  referenceId: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
}): Promise<void> {
  const existing = await prisma.ledgerEntry.findFirst({
    where: {
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    },
  });

  const data = {
    partyId: input.partyId,
    entryDate: input.entryDate,
    description: input.description,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    debitAmount: d(input.debitAmount),
    creditAmount: d(input.creditAmount),
    balance: d(input.balance),
  };

  if (existing) {
    await prisma.ledgerEntry.update({ where: { id: existing.id }, data });
  } else {
    await prisma.ledgerEntry.create({ data });
  }
}

async function main(): Promise<void> {
  console.log("Seeding FabricFlow ERP database...");

  // ─── Admin user ───────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@gmail.com" },
    update: {
      name: "Admin User",
      password: passwordHash,
      role: "ADMIN",
      isActive: true,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
    create: {
      name: "Admin User",
      email: "admin@gmail.com",
      password: passwordHash,
      role: "ADMIN",
      isActive: true,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });
  console.log("✓ Admin user");

  // ─── Parties (masters + extras referenced by other mocks) ─────
  const parties: Array<{
    mockId: string;
    partyNumber: string;
    name: string;
    type: PartyType;
    contact?: string;
    gstNumber?: string;
    city?: string;
    country?: string;
    bankAccount?: string;
    ifsc?: string;
    bankName?: string;
    isActive?: boolean;
  }> = [
    {
      mockId: "party-1",
      partyNumber: "BUY-001",
      name: "Al Reem",
      type: "BUYER",
      contact: "+91 98765 43210",
      gstNumber: "07AAAAA0000A1Z5",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "party-2",
      partyNumber: "BUY-002",
      name: "Baby World",
      type: "BUYER",
      contact: "+91 98765 43211",
      gstNumber: "08BBBBB1111B2Y6",
      city: "Mumbai",
      country: "India",
      bankAccount: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    },
    {
      mockId: "party-3",
      partyNumber: "BUY-003",
      name: "Noor Kids",
      type: "BUYER",
      contact: "+91 98765 43212",
      gstNumber: "09CCCCC2222C3X7",
      city: "Ahmedabad",
      country: "India",
      isActive: false,
    },
    {
      mockId: "buyer-global",
      partyNumber: "BUY-004",
      name: "Global Kidswear Ltd.",
      type: "BUYER",
      contact: "+91 98765 40000",
      gstNumber: "24GGGGG0000G1Z5",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "party-4",
      partyNumber: "SUP-001",
      name: "Sunrise Textiles",
      type: "SUPPLIER",
      contact: "+91 98765 43213",
      gstNumber: "10DDDDD3333D4W8",
      city: "Delhi",
      country: "India",
      bankAccount: "998877665544",
      ifsc: "SBIN0001122",
      bankName: "State Bank of India",
    },
    {
      mockId: "party-5",
      partyNumber: "SUP-002",
      name: "Mehta Fabrics",
      type: "SUPPLIER",
      contact: "+91 98765 43214",
      gstNumber: "11EEEEE4444E5V9",
      city: "Ludhiana",
      country: "India",
      bankAccount: "556677889900",
      ifsc: "ICIC0003344",
      bankName: "ICICI Bank",
    },
    {
      mockId: "party-8",
      partyNumber: "SUP-003",
      name: "Anwar Thread",
      type: "SUPPLIER",
      contact: "+91 98765 43217",
      gstNumber: "12FFFFF5555F6U0",
      city: "Delhi",
      country: "India",
      bankAccount: "334455667788",
      ifsc: "PUNB0009900",
      bankName: "PNB",
    },
    {
      mockId: "supplier-luxe",
      partyNumber: "SUP-004",
      name: "Luxe Textiles Co.",
      type: "SUPPLIER",
      contact: "+91 98765 41111",
      gstNumber: "33LLLLL0000L1Z5",
      city: "Tirupur",
      country: "India",
    },
    {
      mockId: "party-6",
      partyNumber: "KAR-001",
      name: "Ramesh Karigar",
      type: "KARIGAR",
      contact: "+91 98765 43215",
      city: "Surat",
      country: "India",
      bankAccount: "112233445566",
      ifsc: "YESB0005566",
      bankName: "Yes Bank",
    },
    {
      mockId: "party-7",
      partyNumber: "KAR-002",
      name: "Suresh Tailor",
      type: "KARIGAR",
      contact: "+91 98765 43216",
      city: "Surat",
      country: "India",
      bankAccount: "778899001122",
      ifsc: "AXIS0007788",
      bankName: "Axis Bank",
    },
    {
      mockId: "party-9",
      partyNumber: "KAR-003",
      name: "Imran Stitcher",
      type: "KARIGAR",
      contact: "+91 98765 43218",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "party-10",
      partyNumber: "KAR-004",
      name: "Farhan Finisher",
      type: "KARIGAR",
      contact: "+91 98765 43219",
      city: "Surat",
      country: "India",
      isActive: false,
    },
    {
      mockId: "k-mohammed",
      partyNumber: "KAR-005",
      name: "Mohammed Cutter",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-raju",
      partyNumber: "KAR-006",
      name: "Raju Printer",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-abdul",
      partyNumber: "KAR-007",
      name: "Abdul Textile Mills (Karigar)",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-imran",
      partyNumber: "KAR-008",
      name: "Imran Ali",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-anwar",
      partyNumber: "KAR-009",
      name: "Anwar Colorist",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-rashid",
      partyNumber: "KAR-010",
      name: "Rashid Ali",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-salim",
      partyNumber: "KAR-011",
      name: "Mohd. Salim",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-anita",
      partyNumber: "KAR-012",
      name: "Anita Finishing",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-amit",
      partyNumber: "KAR-013",
      name: "Amit Sharma",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-vinod",
      partyNumber: "KAR-014",
      name: "Vinod Gupta (Printer Expert)",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-amit-k",
      partyNumber: "KAR-015",
      name: "Amit Kumar",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "k-mohammad",
      partyNumber: "KAR-016",
      name: "Mohammad Salim",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
    {
      mockId: "party-extra-1",
      partyNumber: "KAR-017",
      name: "Arjun Kumar",
      type: "KARIGAR",
      contact: "+91 90000 00000",
      city: "Surat",
      country: "India",
    },
  ];

  for (const party of parties) {
    await upsertParty(party);
  }
  console.log(`✓ Parties (${parties.length})`);

  // ─── Products + stock ─────────────────────────────────────────
  const stockByMockProductId: Record<string, number> = {
    "prod-1": 1840,
    "prod-2": 320,
    "prod-3": 4200,
    "prod-4": 124,
    "prod-5": 540,
    "prod-7": 12500,
    "prod-8": 960,
    "prod-9": 180,
    "prod-sleepsuit": 0,
    "prod-fleece": 720,
    "prod-poplin": 1840,
    "prod-scrap": 48,
    "prod-cotton-fabric": 1840,
    "prod-cut-d42": 0,
    "prod-printed": 0,
    "prod-pattern": 0,
  };

  const products: Array<{
    mockId: string;
    productCode: string;
    name: string;
    category: ProductCategory;
    unit: UnitOfMeasure;
    gstRate: number;
    description?: string;
    isActive?: boolean;
    sizes?: SizeLabel[];
  }> = [
    {
      mockId: "prod-1",
      productCode: "RM-001",
      name: "Cotton",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Premium cotton fabric",
    },
    {
      mockId: "prod-5",
      productCode: "RM-002",
      name: "Rib Knit",
      category: "RAW_MATERIAL",
      unit: "METERS",
      gstRate: 5,
      description: "Rib knit fabric",
      isActive: false,
    },
    {
      mockId: "prod-8",
      productCode: "RM-003",
      name: "Interlock Fabric",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Soft interlock",
    },
    {
      mockId: "prod-cotton-fabric",
      productCode: "RM-004",
      name: "Cotton Interlock Fabric",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Cotton interlock fabric",
    },
    {
      mockId: "prod-fleece",
      productCode: "RM-005",
      name: "Fleece Fabric",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Fleece fabric",
    },
    {
      mockId: "prod-poplin",
      productCode: "RM-006",
      name: "Cotton Poplin - Navy Blue",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Cotton poplin navy blue",
    },
    {
      mockId: "prod-cotton-240",
      productCode: "RM-007",
      name: "Cotton Interlock - 240 GSM",
      category: "RAW_MATERIAL",
      unit: "KG",
      gstRate: 5,
      description: "Cotton interlock 240 GSM",
    },
    {
      mockId: "prod-2",
      productCode: "FG-001",
      name: "Baby Bodysuit",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Infant bodysuit",
      sizes: ["SIZE_0_3M", "SIZE_3_6M", "SIZE_6_9M"],
    },
    {
      mockId: "prod-6",
      productCode: "FG-002",
      name: "Kids Summer Jumper",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Summer jumper for kids",
      sizes: [
        "SIZE_0_3M",
        "SIZE_3_6M",
        "SIZE_6_9M",
        "SIZE_9_12M",
        "SIZE_12_18M",
        "SIZE_18_24M",
      ],
    },
    {
      mockId: "prod-9",
      productCode: "FG-003",
      name: "Romper Set",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Baby romper set",
    },
    {
      mockId: "prod-sleepsuit",
      productCode: "FG-004",
      name: "Baby Sleepsuit 0-3M",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Baby sleepsuit",
    },
    {
      mockId: "prod-cut-d42",
      productCode: "FG-005",
      name: "Cut Pieces D-42",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Cut pieces D-42",
    },
    {
      mockId: "prod-printed",
      productCode: "FG-006",
      name: "Printed Pieces",
      category: "FINISHED_GOOD",
      unit: "PCS",
      gstRate: 5,
      description: "Printed pieces",
    },
    {
      mockId: "prod-3",
      productCode: "ACC-001",
      name: "Poly Bag",
      category: "ACCESSORY",
      unit: "PCS",
      gstRate: 12,
      description: "Packaging poly bag",
    },
    {
      mockId: "prod-7",
      productCode: "ACC-002",
      name: "Snap Buttons",
      category: "ACCESSORY",
      unit: "PCS",
      gstRate: 12,
      description: "Plastic snap buttons",
    },
    {
      mockId: "prod-pattern",
      productCode: "ACC-003",
      name: "Pattern Paper",
      category: "ACCESSORY",
      unit: "PCS",
      gstRate: 12,
      description: "Pattern paper",
    },
    {
      mockId: "prod-4",
      productCode: "WST-001",
      name: "Cutting Scrap",
      category: "WASTAGE",
      unit: "KG",
      gstRate: 5,
      description: "Fabric cutting wastage",
    },
    {
      mockId: "prod-scrap",
      productCode: "WST-002",
      name: "Mixed Fabric Scrap",
      category: "WASTAGE",
      unit: "KG",
      gstRate: 5,
      description: "Mixed fabric scrap",
    },
  ];

  for (const product of products) {
    await upsertProduct({
      ...product,
      stockQty: stockByMockProductId[product.mockId] ?? 0,
    });
  }
  // Alias for inventory product names that map to existing products
  productIds.set("prod-rib", productIds.get("prod-5")!);
  productIds.set("prod-snap", productIds.get("prod-7")!);
  productIds.set("prod-romper", productIds.get("prod-9")!);
  productIds.set("prod-bodysuit-03", productIds.get("prod-2")!);
  productIds.set("prod-poly-small", productIds.get("prod-3")!);
  productIds.set("prod-wastage-fabric", productIds.get("prod-4")!);
  console.log(`✓ Products + stock (${products.length})`);

  // ─── Operations ───────────────────────────────────────────────
  const operations: Array<{
    mockId: string;
    operationCode: string;
    name: string;
    stage: ProductionStage;
    ratePerPiece: number;
  }> = [
    { mockId: "op-1", operationCode: "OP-001", name: "Pattern Cutting", stage: "CUTTING", ratePerPiece: 1.5 },
    { mockId: "op-2", operationCode: "OP-002", name: "Fabric Cutting", stage: "CUTTING", ratePerPiece: 3.2 },
    { mockId: "op-3", operationCode: "OP-003", name: "Screen Printing", stage: "PRINTING", ratePerPiece: 4.0 },
    { mockId: "op-4", operationCode: "OP-004", name: "Fabric Dyeing", stage: "COLORING", ratePerPiece: 2.75 },
    { mockId: "op-5", operationCode: "OP-005", name: "Overlock", stage: "STITCHING", ratePerPiece: 0.4 },
    { mockId: "op-6", operationCode: "OP-006", name: "Flatlock", stage: "STITCHING", ratePerPiece: 0.55 },
    { mockId: "op-7", operationCode: "OP-007", name: "Lock Stitch", stage: "STITCHING", ratePerPiece: 0.35 },
    { mockId: "op-8", operationCode: "OP-008", name: "Ripping", stage: "STITCHING", ratePerPiece: 0.25 },
    { mockId: "op-9", operationCode: "OP-009", name: "Thread Cutting", stage: "FINISHING", ratePerPiece: 0.2 },
    { mockId: "op-10", operationCode: "OP-010", name: "Ironing & Pack", stage: "FINISHING", ratePerPiece: 1.1 },
    { mockId: "prod-op-cut", operationCode: "OP-011", name: "Fabric Cutting (Prod)", stage: "CUTTING", ratePerPiece: 0.75 },
    { mockId: "prod-op-print", operationCode: "OP-012", name: "Screen Printing (Prod)", stage: "PRINTING", ratePerPiece: 2.0 },
    { mockId: "prod-op-color", operationCode: "OP-013", name: "Coloring", stage: "COLORING", ratePerPiece: 1.2 },
    { mockId: "prod-op-side", operationCode: "OP-014", name: "Side Seam", stage: "STITCHING", ratePerPiece: 0.55 },
    { mockId: "prod-op-sleeve", operationCode: "OP-015", name: "Sleeve Attach", stage: "STITCHING", ratePerPiece: 0.6 },
    { mockId: "prod-op-collar", operationCode: "OP-016", name: "Collar Prep", stage: "STITCHING", ratePerPiece: 0.45 },
    { mockId: "prod-op-overlock", operationCode: "OP-017", name: "Overlock (Prod)", stage: "STITCHING", ratePerPiece: 1.0 },
    { mockId: "prod-op-bottom", operationCode: "OP-018", name: "Bottom Hem", stage: "STITCHING", ratePerPiece: 0.5 },
    { mockId: "prod-op-flatlock", operationCode: "OP-019", name: "Flatlock (Prod)", stage: "STITCHING", ratePerPiece: 0.55 },
    { mockId: "prod-op-lock", operationCode: "OP-020", name: "Lock Stitch (Prod)", stage: "STITCHING", ratePerPiece: 0.35 },
    { mockId: "prod-op-iron", operationCode: "OP-021", name: "Ironing", stage: "FINISHING", ratePerPiece: 0.3 },
    { mockId: "prod-op-poly", operationCode: "OP-022", name: "Poly Packing", stage: "FINISHING", ratePerPiece: 0.25 },
    { mockId: "prod-op-gift", operationCode: "OP-023", name: "Gift Packing", stage: "FINISHING", ratePerPiece: 0.4 },
    { mockId: "prod-op-hanger", operationCode: "OP-024", name: "Hanger Attachment", stage: "FINISHING", ratePerPiece: 0.2 },
  ];

  for (const op of operations) {
    await upsertOperation(op);
  }
  console.log(`✓ Operations (${operations.length})`);

  // ─── GST rates ────────────────────────────────────────────────
  const gstRates = [
    {
      category: "Finished Garments (Export)",
      gstPercent: 0,
      taxType: "ZERO_RATED" as const,
      applicableOn: "Export Invoices",
      notes: "Zero rated for exports",
    },
    {
      category: "Raw Fabric",
      gstPercent: 5,
      taxType: "CGST_SGST" as const,
      applicableOn: "In-state Purchase",
      notes: "Standard fabric GST",
    },
    {
      category: "Accessories",
      gstPercent: 12,
      taxType: "IGST" as const,
      applicableOn: "Inter-state Purchase",
      notes: "Accessories GST",
    },
    {
      category: "Cutting Wastage",
      gstPercent: 5,
      taxType: "CGST_SGST" as const,
      applicableOn: "Scrap Sale",
      notes: "Wastage sale GST",
    },
    {
      category: "Job Work",
      gstPercent: 5,
      taxType: "CGST_SGST" as const,
      applicableOn: "Service Charges",
      notes: "Job work services",
    },
    {
      category: "Packing",
      gstPercent: 12,
      taxType: "CGST_SGST" as const,
      applicableOn: "Material Supply",
      notes: "Packing materials",
    },
    {
      category: "Domestic Sale",
      gstPercent: 5,
      taxType: "CGST_SGST" as const,
      applicableOn: "Local B2B/B2C",
      notes: "Domestic garment sale",
    },
  ];

  for (const rate of gstRates) {
    const existing = await prisma.gSTRate.findFirst({
      where: { category: rate.category },
    });
    const data = {
      category: rate.category,
      gstPercent: d(rate.gstPercent),
      taxType: rate.taxType,
      applicableOn: rate.applicableOn,
      notes: rate.notes,
    };
    if (existing) {
      await prisma.gSTRate.update({ where: { id: existing.id }, data });
    } else {
      await prisma.gSTRate.create({ data });
    }
  }
  console.log(`✓ GST rates (${gstRates.length})`);

  // ─── Karigar profiles ─────────────────────────────────────────
  const karigarProfiles = [
    {
      partyMockId: "party-6",
      paymentType: "PIECE_RATE" as const,
      weeklySalary: 0,
      isActive: true,
      operationMockIds: ["op-5", "op-6"],
    },
    {
      partyMockId: "party-7",
      paymentType: "BOTH" as const,
      weeklySalary: 4500,
      isActive: true,
      operationMockIds: ["op-7", "op-9"],
    },
    {
      partyMockId: "party-9",
      paymentType: "WEEKLY_SALARY" as const,
      weeklySalary: 5200,
      isActive: true,
      operationMockIds: [] as string[],
    },
    {
      partyMockId: "party-10",
      paymentType: "PIECE_RATE" as const,
      weeklySalary: 0,
      isActive: false,
      operationMockIds: ["op-10"],
    },
  ];

  for (const profile of karigarProfiles) {
    const partyId = partyIds.get(profile.partyMockId)!;
    const karigar = await prisma.karigarProfile.upsert({
      where: { partyId },
      update: {
        paymentType: profile.paymentType,
        weeklySalary: d(profile.weeklySalary),
        isActive: profile.isActive,
      },
      create: {
        partyId,
        paymentType: profile.paymentType,
        weeklySalary: d(profile.weeklySalary),
        isActive: profile.isActive,
      },
    });

    await prisma.karigarOperation.deleteMany({
      where: { karigarProfileId: karigar.id },
    });

    for (const opMockId of profile.operationMockIds) {
      const operationId = operationIds.get(opMockId);
      if (!operationId) continue;
      await prisma.karigarOperation.create({
        data: { karigarProfileId: karigar.id, operationId },
      });
    }
  }
  console.log(`✓ Karigar profiles (${karigarProfiles.length})`);

  // ─── Purchase orders ──────────────────────────────────────────
  const purchaseOrders = [
    {
      mockId: "po-1",
      poNumber: "PO-2024-001",
      buyerMockId: "party-1",
      buyerPoReference: "AR/2024/001",
      orderDate: "2024-01-15",
      deliveryDate: "2024-03-30",
      shippingDestination: "Dubai, UAE",
      paymentTerms: "CIF, 60 Days",
      specialInstructions: "Care labels in Arabic and English required.",
      status: "ACTIVE" as const,
      totalPieces: 5000,
      totalDesigns: 3,
      items: [
        {
          mockId: "poi-1",
          designNumber: "D-41",
          garmentType: "Baby Bodysuit",
          color: "White",
          qty_0_3M: 200,
          qty_3_6M: 300,
          qty_6_9M: 400,
          qty_9_12M: 400,
          qty_12_18M: 350,
          qty_18_24M: 350,
          totalPieces: 2000,
        },
      ],
    },
    {
      mockId: "po-2",
      poNumber: "PO-2024-002",
      buyerMockId: "party-2",
      buyerPoReference: "BW/2024/UAE-09",
      orderDate: "2024-01-18",
      deliveryDate: "2024-04-15",
      shippingDestination: "Dubai, UAE",
      paymentTerms: "CIF, 60 Days",
      specialInstructions:
        "All garments must have care label in Arabic and English. Export quality packaging required.",
      status: "IN_PRODUCTION" as const,
      totalPieces: 3200,
      totalDesigns: 2,
      items: [
        {
          mockId: "poi-2a",
          designNumber: "DSGN-1021",
          garmentType: "Romper",
          color: "Cloud Blue",
          qty_0_3M: 200,
          qty_3_6M: 300,
          qty_6_9M: 400,
          qty_9_12M: 350,
          qty_12_18M: 250,
          qty_18_24M: 100,
          totalPieces: 1600,
        },
        {
          mockId: "poi-2b",
          designNumber: "DSGN-1022",
          garmentType: "T-Shirt",
          color: "Soft Mint",
          qty_0_3M: 250,
          qty_3_6M: 350,
          qty_6_9M: 400,
          qty_9_12M: 300,
          qty_12_18M: 200,
          qty_18_24M: 100,
          totalPieces: 1600,
        },
      ],
    },
    {
      mockId: "po-3",
      poNumber: "PO-2024-003",
      buyerMockId: "party-3",
      buyerPoReference: "NK/2024/12",
      orderDate: "2024-01-20",
      deliveryDate: "2024-04-10",
      shippingDestination: "Ahmedabad, India",
      paymentTerms: "50% Advance, 50% on Delivery",
      specialInstructions: "",
      status: "READY_TO_SHIP" as const,
      totalPieces: 2800,
      totalDesigns: 2,
      items: [],
    },
    {
      mockId: "po-4",
      poNumber: "PO-2024-004",
      buyerMockId: "party-1",
      buyerPoReference: "AR/2024/044",
      orderDate: "2024-01-22",
      deliveryDate: "2024-03-15",
      shippingDestination: "Jebel Ali Port, UAE",
      paymentTerms: "LC at Sight",
      specialInstructions: "",
      status: "IN_PRODUCTION" as const,
      totalPieces: 4500,
      totalDesigns: 4,
      items: [],
    },
    {
      mockId: "po-5",
      poNumber: "PO-2024-005",
      buyerMockId: "party-2",
      buyerPoReference: "BW/2024/55",
      orderDate: "2024-01-25",
      deliveryDate: "2024-04-20",
      shippingDestination: "Mumbai, India",
      paymentTerms: "Net 30",
      specialInstructions: "",
      status: "ACTIVE" as const,
      totalPieces: 1800,
      totalDesigns: 1,
      items: [],
    },
    {
      mockId: "po-6",
      poNumber: "PO-2024-006",
      buyerMockId: "buyer-global",
      buyerPoReference: "GK/2024/66",
      orderDate: "2024-01-28",
      deliveryDate: "2024-03-28",
      shippingDestination: "Hamburg Port, Germany",
      paymentTerms: "50% Advance, 50% on Delivery",
      specialInstructions: "",
      status: "COMPLETED" as const,
      totalPieces: 6200,
      totalDesigns: 5,
      items: [],
    },
    {
      mockId: "po-7",
      poNumber: "PO-2024-007",
      buyerMockId: "party-1",
      buyerPoReference: "TT/2024/77",
      orderDate: "2024-02-01",
      deliveryDate: "2024-04-01",
      shippingDestination: "Delhi, India",
      paymentTerms: "Net 45",
      specialInstructions: "",
      status: "CANCELLED" as const,
      totalPieces: 2100,
      totalDesigns: 2,
      items: [],
    },
    {
      mockId: "po-8",
      poNumber: "PO-2024-008",
      buyerMockId: "party-2",
      buyerPoReference: "LS/2024/88",
      orderDate: "2024-02-05",
      deliveryDate: "2024-05-01",
      shippingDestination: "Ludhiana, India",
      paymentTerms: "CIF, 30 Days",
      specialInstructions: "",
      status: "READY_TO_SHIP" as const,
      totalPieces: 3900,
      totalDesigns: 3,
      items: [],
    },
  ];

  for (const po of purchaseOrders) {
    const buyerId = partyIds.get(po.buyerMockId)!;
    const record = await prisma.purchaseOrder.upsert({
      where: { poNumber: po.poNumber },
      update: {
        buyerId,
        buyerPoReference: po.buyerPoReference || null,
        orderDate: date(po.orderDate),
        deliveryDate: date(po.deliveryDate),
        shippingDestination: po.shippingDestination || null,
        paymentTerms: po.paymentTerms || null,
        specialInstructions: po.specialInstructions || null,
        status: po.status,
        totalPieces: po.totalPieces,
        totalDesigns: po.totalDesigns,
      },
      create: {
        poNumber: po.poNumber,
        buyerId,
        buyerPoReference: po.buyerPoReference || null,
        orderDate: date(po.orderDate),
        deliveryDate: date(po.deliveryDate),
        shippingDestination: po.shippingDestination || null,
        paymentTerms: po.paymentTerms || null,
        specialInstructions: po.specialInstructions || null,
        status: po.status,
        totalPieces: po.totalPieces,
        totalDesigns: po.totalDesigns,
      },
    });
    poIds.set(po.mockId, record.id);

    await prisma.pOItem.deleteMany({ where: { poId: record.id } });
    for (const item of po.items) {
      const created = await prisma.pOItem.create({
        data: {
          poId: record.id,
          designNumber: item.designNumber,
          garmentType: item.garmentType,
          color: item.color,
          qty_0_3M: item.qty_0_3M,
          qty_3_6M: item.qty_3_6M,
          qty_6_9M: item.qty_6_9M,
          qty_9_12M: item.qty_9_12M,
          qty_12_18M: item.qty_12_18M,
          qty_18_24M: item.qty_18_24M,
          totalPieces: item.totalPieces,
        },
      });
      poItemIds.set(item.mockId, created.id);
    }
  }
  console.log(`✓ Purchase orders (${purchaseOrders.length})`);

  // ─── Purchase bills ───────────────────────────────────────────
  const purchaseBills = [
    {
      mockId: "bill-1",
      billNumber: "PB-001",
      supplierMockId: "party-4",
      supplierInvoiceNo: "ST-INV-4421",
      purchaseDate: "2024-01-20",
      poMockId: "po-2",
      productMockId: "prod-1",
      vehicleNumber: "GJ-05-AB-1234",
      grossWeight: 1040,
      tareWeight: 40,
      netWeight: 1000,
      ratePerKg: 180,
      gstPercent: 5,
      gstAmount: 9000,
      totalAmount: 189000,
      status: "CONFIRMED" as const,
      confirmedAt: "2024-01-20T11:32:00.000Z",
    },
    {
      mockId: "bill-2",
      billNumber: "PB-002",
      supplierMockId: "party-5",
      supplierInvoiceNo: "MF-8821",
      purchaseDate: "2024-01-22",
      poMockId: "po-1",
      productMockId: "prod-8",
      vehicleNumber: "PB-10-CD-7788",
      grossWeight: 860,
      tareWeight: 40,
      netWeight: 820,
      ratePerKg: 210,
      gstPercent: 5,
      gstAmount: 8610,
      totalAmount: 180810,
      status: "PENDING" as const,
      confirmedAt: null,
    },
    {
      mockId: "bill-3",
      billNumber: "PB-003",
      supplierMockId: "party-8",
      supplierInvoiceNo: "AT-3301",
      purchaseDate: "2024-01-24",
      poMockId: "po-4",
      productMockId: "prod-5",
      vehicleNumber: "DL-01-EF-2211",
      grossWeight: 520,
      tareWeight: 20,
      netWeight: 500,
      ratePerKg: 195,
      gstPercent: 5,
      gstAmount: 4875,
      totalAmount: 102375,
      status: "CONFIRMED" as const,
      confirmedAt: "2024-01-24T10:00:00.000Z",
    },
    {
      mockId: "bill-4",
      billNumber: "PB-004",
      supplierMockId: "party-4",
      supplierInvoiceNo: "ST-INV-4502",
      purchaseDate: "2024-01-26",
      poMockId: "po-2",
      productMockId: "prod-1",
      vehicleNumber: "GJ-05-XY-9988",
      grossWeight: 1280,
      tareWeight: 50,
      netWeight: 1230,
      ratePerKg: 185,
      gstPercent: 5,
      gstAmount: 11377.5,
      totalAmount: 238727.5,
      status: "RETURNED" as const,
      confirmedAt: "2024-01-26T09:00:00.000Z",
    },
    {
      mockId: "bill-5",
      billNumber: "PB-005",
      supplierMockId: "party-5",
      supplierInvoiceNo: "MF-9011",
      purchaseDate: "2024-01-28",
      poMockId: "po-5",
      productMockId: "prod-8",
      vehicleNumber: "MH-12-GH-3344",
      grossWeight: 760,
      tareWeight: 30,
      netWeight: 730,
      ratePerKg: 205,
      gstPercent: 5,
      gstAmount: 7482.5,
      totalAmount: 157132.5,
      status: "PENDING" as const,
      confirmedAt: null,
    },
    {
      mockId: "bill-6",
      billNumber: "PB-006",
      supplierMockId: "supplier-luxe",
      supplierInvoiceNo: "LX-2201",
      purchaseDate: "2024-01-30",
      poMockId: "po-3",
      productMockId: "prod-1",
      vehicleNumber: "TN-37-AB-1234",
      grossWeight: 1100,
      tareWeight: 45,
      netWeight: 1055,
      ratePerKg: 190,
      gstPercent: 5,
      gstAmount: 10022.5,
      totalAmount: 210472.5,
      status: "CONFIRMED" as const,
      confirmedAt: "2024-01-30T14:00:00.000Z",
    },
    {
      mockId: "bill-7",
      billNumber: "PB-007",
      supplierMockId: "party-4",
      supplierInvoiceNo: "ST-INV-4600",
      purchaseDate: "2024-02-02",
      poMockId: "po-8",
      productMockId: "prod-5",
      vehicleNumber: "RJ-14-KL-5566",
      grossWeight: 640,
      tareWeight: 25,
      netWeight: 615,
      ratePerKg: 200,
      gstPercent: 5,
      gstAmount: 6150,
      totalAmount: 129150,
      status: "PENDING" as const,
      confirmedAt: null,
    },
  ];

  for (const bill of purchaseBills) {
    const record = await prisma.purchaseBill.upsert({
      where: { billNumber: bill.billNumber },
      update: {
        supplierId: partyIds.get(bill.supplierMockId)!,
        supplierInvoiceNo: bill.supplierInvoiceNo,
        purchaseDate: date(bill.purchaseDate),
        poId: poIds.get(bill.poMockId)!,
        productId: productIds.get(bill.productMockId)!,
        vehicleNumber: bill.vehicleNumber,
        grossWeight: d(bill.grossWeight),
        tareWeight: d(bill.tareWeight),
        netWeight: d(bill.netWeight),
        ratePerKg: d(bill.ratePerKg),
        gstPercent: d(bill.gstPercent),
        gstAmount: d(bill.gstAmount),
        totalAmount: d(bill.totalAmount),
        status: bill.status,
        confirmedAt: bill.confirmedAt ? date(bill.confirmedAt) : null,
      },
      create: {
        billNumber: bill.billNumber,
        supplierId: partyIds.get(bill.supplierMockId)!,
        supplierInvoiceNo: bill.supplierInvoiceNo,
        purchaseDate: date(bill.purchaseDate),
        poId: poIds.get(bill.poMockId)!,
        productId: productIds.get(bill.productMockId)!,
        vehicleNumber: bill.vehicleNumber,
        grossWeight: d(bill.grossWeight),
        tareWeight: d(bill.tareWeight),
        netWeight: d(bill.netWeight),
        ratePerKg: d(bill.ratePerKg),
        gstPercent: d(bill.gstPercent),
        gstAmount: d(bill.gstAmount),
        totalAmount: d(bill.totalAmount),
        status: bill.status,
        confirmedAt: bill.confirmedAt ? date(bill.confirmedAt) : null,
      },
    });
    billIds.set(bill.mockId, record.id);
  }
  console.log(`✓ Purchase bills (${purchaseBills.length})`);

  // ─── Issue records + bundles ──────────────────────────────────
  const issues = [
    {
      issueNumber: "ISS-041",
      issueDate: "2024-02-20",
      issueType: "CUTTING" as const,
      productMockId: "prod-cotton-fabric",
      poMockId: "po-2",
      karigarMockId: "k-mohammed",
      quantityIssued: 200,
      bundleNumber: "BND-041",
      status: "RETURNED" as const,
    },
    {
      issueNumber: "ISS-042",
      issueDate: "2024-02-20",
      issueType: "PRINTING" as const,
      productMockId: "prod-cut-d42",
      poMockId: "po-2",
      karigarMockId: "k-raju",
      quantityIssued: 450,
      bundleNumber: "BND-042",
      status: "ISSUED" as const,
    },
    {
      issueNumber: "ISS-043",
      issueDate: "2024-02-19",
      issueType: "STITCHING" as const,
      productMockId: "prod-printed",
      poMockId: "po-1",
      karigarMockId: "party-7",
      quantityIssued: 380,
      bundleNumber: "BND-043",
      status: "ISSUED" as const,
    },
    {
      issueNumber: "ISS-044",
      issueDate: "2024-02-18",
      issueType: "SAMPLE" as const,
      productMockId: "prod-fleece",
      poMockId: "po-4",
      karigarMockId: "party-6",
      quantityIssued: 25,
      bundleNumber: "BND-044",
      status: "PARTIAL" as const,
    },
    {
      issueNumber: "ISS-045",
      issueDate: "2024-02-18",
      issueType: "PATTERN" as const,
      productMockId: "prod-pattern",
      poMockId: "po-1",
      karigarMockId: "k-mohammed",
      quantityIssued: 12,
      bundleNumber: "BND-045",
      status: "RETURNED" as const,
    },
    {
      issueNumber: "ISS-046",
      issueDate: "2024-02-17",
      issueType: "CUTTING" as const,
      productMockId: "prod-poplin",
      poMockId: "po-3",
      karigarMockId: "k-abdul",
      quantityIssued: 150,
      bundleNumber: "BND-046",
      status: "ISSUED" as const,
    },
    {
      issueNumber: "ISS-047",
      issueDate: "2024-02-16",
      issueType: "STITCHING" as const,
      productMockId: "prod-cut-d42",
      poMockId: "po-2",
      karigarMockId: "party-7",
      quantityIssued: 220,
      bundleNumber: "BND-047",
      status: "PARTIAL" as const,
    },
    {
      issueNumber: "ISS-048",
      issueDate: "2024-02-15",
      issueType: "SAMPLE" as const,
      productMockId: "prod-printed",
      poMockId: "po-5",
      karigarMockId: "k-raju",
      quantityIssued: 0,
      bundleNumber: "BND-048",
      status: "PARTIAL" as const,
    },
  ];

  for (const issue of issues) {
    const record = await prisma.issueRecord.upsert({
      where: { issueNumber: issue.issueNumber },
      update: {
        issueDate: date(issue.issueDate),
        issueType: issue.issueType,
        productId: productIds.get(issue.productMockId)!,
        poId: poIds.get(issue.poMockId)!,
        karigarId: partyIds.get(issue.karigarMockId)!,
        quantityIssued: d(issue.quantityIssued),
        bundleNumber: issue.bundleNumber,
        createdById: admin.id,
        status: issue.status,
      },
      create: {
        issueNumber: issue.issueNumber,
        issueDate: date(issue.issueDate),
        issueType: issue.issueType,
        productId: productIds.get(issue.productMockId)!,
        poId: poIds.get(issue.poMockId)!,
        karigarId: partyIds.get(issue.karigarMockId)!,
        quantityIssued: d(issue.quantityIssued),
        bundleNumber: issue.bundleNumber,
        createdById: admin.id,
        status: issue.status,
      },
    });

    await ensureBundle({
      bundleNumber: issue.bundleNumber,
      poMockId: issue.poMockId,
      issueId: record.id,
      currentStage:
        issue.issueType === "CUTTING"
          ? "CUTTING"
          : issue.issueType === "PRINTING"
            ? "PRINTING"
            : issue.issueType === "STITCHING"
              ? "STITCHING"
              : "CUTTING",
    });
  }
  console.log(`✓ Issue records + bundles (${issues.length})`);

  // Extra production bundles
  const extraBundles = [
    { bundleNumber: "B-102", poMockId: "po-1", currentStage: "CUTTING" as const },
    { bundleNumber: "BND-001", poMockId: "po-1", currentStage: "FINISHING" as const },
    { bundleNumber: "BND-002", poMockId: "po-2", currentStage: "COLORING" as const },
    { bundleNumber: "BND-003", poMockId: "po-3", currentStage: "STITCHING" as const },
    { bundleNumber: "BND-004", poMockId: "po-3", currentStage: "COLORING" as const },
    { bundleNumber: "BNDL-004", poMockId: "po-1", currentStage: "STITCHING" as const },
    { bundleNumber: "BNDL-005", poMockId: "po-2", currentStage: "STITCHING" as const },
    { bundleNumber: "BNDL-006", poMockId: "po-1", currentStage: "STITCHING" as const },
    { bundleNumber: "BNDL-007", poMockId: "po-3", currentStage: "STITCHING" as const },
    { bundleNumber: "BNDL-008", poMockId: "po-2", currentStage: "STITCHING" as const },
  ];
  for (const b of extraBundles) {
    await ensureBundle(b);
  }

  // ─── Cutting wastage ──────────────────────────────────────────
  const wastageEntries = [
    {
      wastageNumber: "CW-001",
      poMockId: "po-1",
      designCode: "D-42",
      fabricMockId: "prod-cotton-fabric",
      wastageQty: 18,
      returnedByMockId: "k-mohammed",
      dateOfReturn: "2024-01-21",
      status: "SOLD" as const,
    },
    {
      wastageNumber: "CW-002",
      poMockId: "po-2",
      designCode: "DSGN-1021",
      fabricMockId: "prod-cotton-fabric",
      wastageQty: 22,
      returnedByMockId: "k-mohammed",
      dateOfReturn: "2024-01-22",
      status: "IN_STOCK" as const,
    },
    {
      wastageNumber: "CW-003",
      poMockId: "po-4",
      designCode: "D-55",
      fabricMockId: "prod-fleece",
      wastageQty: 31,
      returnedByMockId: "party-6",
      dateOfReturn: "2024-01-24",
      status: "IN_STOCK" as const,
    },
    {
      wastageNumber: "CW-004",
      poMockId: "po-1",
      designCode: "D-43",
      fabricMockId: "prod-5",
      wastageQty: 14,
      returnedByMockId: "party-7",
      dateOfReturn: "2024-01-26",
      status: "SOLD" as const,
    },
    {
      wastageNumber: "CW-005",
      poMockId: "po-3",
      designCode: "D-60",
      fabricMockId: "prod-poplin",
      wastageQty: 27,
      returnedByMockId: "k-abdul",
      dateOfReturn: "2024-01-28",
      status: "IN_STOCK" as const,
    },
    {
      wastageNumber: "CW-006",
      poMockId: "po-8",
      designCode: "D-71",
      fabricMockId: "prod-cotton-fabric",
      wastageQty: 60,
      returnedByMockId: "k-mohammed",
      dateOfReturn: "2024-01-30",
      status: "SOLD" as const,
    },
  ];

  for (const w of wastageEntries) {
    await prisma.cuttingWastage.upsert({
      where: { wastageNumber: w.wastageNumber },
      update: {
        poId: poIds.get(w.poMockId)!,
        designCode: w.designCode,
        fabricTypeId: productIds.get(w.fabricMockId)!,
        wastageQty: d(w.wastageQty),
        returnedById: partyIds.get(w.returnedByMockId)!,
        dateOfReturn: date(w.dateOfReturn),
        status: w.status,
      },
      create: {
        wastageNumber: w.wastageNumber,
        poId: poIds.get(w.poMockId)!,
        designCode: w.designCode,
        fabricTypeId: productIds.get(w.fabricMockId)!,
        wastageQty: d(w.wastageQty),
        returnedById: partyIds.get(w.returnedByMockId)!,
        dateOfReturn: date(w.dateOfReturn),
        status: w.status,
      },
    });
  }
  console.log(`✓ Cutting wastage (${wastageEntries.length})`);

  // ─── Production entries ───────────────────────────────────────
  const cuttingEntries = [
    {
      mockId: "ce-1",
      entryNumber: "CE-8821",
      bundleNumber: "B-102",
      poMockId: "po-1",
      karigarMockId: "k-imran",
      entryDate: "2023-10-24",
      fabricIssuedKg: 120.5,
      totalPiecesCut: 920,
      sizes: { qty_0_3M: 200, qty_3_6M: 400, qty_6_9M: 320, qty_9_12M: 0, qty_12_18M: 0, qty_18_24M: 0 },
      wastageKg: 18.2,
    },
    {
      mockId: "ce-2",
      entryNumber: "CE-8822",
      bundleNumber: "BND-001",
      poMockId: "po-2",
      karigarMockId: "k-amit",
      entryDate: "2024-01-20",
      fabricIssuedKg: 98.4,
      totalPiecesCut: 850,
      sizes: { qty_0_3M: 150, qty_3_6M: 200, qty_6_9M: 200, qty_9_12M: 150, qty_12_18M: 100, qty_18_24M: 50 },
      wastageKg: 12.5,
    },
    {
      mockId: "ce-3",
      entryNumber: "CE-8823",
      bundleNumber: "BND-002",
      poMockId: "po-1",
      karigarMockId: "k-amit",
      entryDate: "2024-01-21",
      fabricIssuedKg: 110.0,
      totalPiecesCut: 970,
      sizes: { qty_0_3M: 160, qty_3_6M: 180, qty_6_9M: 200, qty_9_12M: 150, qty_12_18M: 140, qty_18_24M: 140 },
      wastageKg: 1.25,
    },
    {
      mockId: "ce-4",
      entryNumber: "CE-8824",
      bundleNumber: "BND-003",
      poMockId: "po-3",
      karigarMockId: "k-imran",
      entryDate: "2024-01-22",
      fabricIssuedKg: 75.2,
      totalPiecesCut: 640,
      sizes: { qty_0_3M: 100, qty_3_6M: 120, qty_6_9M: 140, qty_9_12M: 120, qty_12_18M: 80, qty_18_24M: 80 },
      wastageKg: 8.4,
    },
  ];

  for (const entry of cuttingEntries) {
    const record = await prisma.cuttingEntry.upsert({
      where: { entryNumber: entry.entryNumber },
      update: {
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        fabricIssuedKg: d(entry.fabricIssuedKg),
        totalPiecesCut: entry.totalPiecesCut,
        ...entry.sizes,
        wastageKg: d(entry.wastageKg),
      },
      create: {
        entryNumber: entry.entryNumber,
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        fabricIssuedKg: d(entry.fabricIssuedKg),
        totalPiecesCut: entry.totalPiecesCut,
        ...entry.sizes,
        wastageKg: d(entry.wastageKg),
      },
    });
    cuttingEntryIds.set(entry.mockId, record.id);
  }

  const printingEntries = [
    { mockId: "pr-1", entryNumber: "PR-001", bundleNumber: "BND-001", poMockId: "po-1", karigarMockId: "k-raju", entryDate: "2024-01-21", piecesReceived: 980, piecesReturned: 978, piecesRejected: 2 },
    { mockId: "pr-2", entryNumber: "PR-002", bundleNumber: "BND-002", poMockId: "po-2", karigarMockId: "k-vinod", entryDate: "2024-01-22", piecesReceived: 970, piecesReturned: 965, piecesRejected: 5 },
    { mockId: "pr-3", entryNumber: "PR-003", bundleNumber: "BND-003", poMockId: "po-1", karigarMockId: "k-raju", entryDate: "2024-01-23", piecesReceived: 850, piecesReturned: 848, piecesRejected: 2 },
    { mockId: "pr-4", entryNumber: "PR-004", bundleNumber: "BND-004", poMockId: "po-3", karigarMockId: "k-raju", entryDate: "2024-01-24", piecesReceived: 640, piecesReturned: 638, piecesRejected: 2 },
  ];

  for (const entry of printingEntries) {
    const record = await prisma.printingEntry.upsert({
      where: { entryNumber: entry.entryNumber },
      update: {
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        piecesReceived: entry.piecesReceived,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
      create: {
        entryNumber: entry.entryNumber,
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        piecesReceived: entry.piecesReceived,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
    });
    printingEntryIds.set(entry.mockId, record.id);
  }

  const coloringEntries = [
    { mockId: "cl-1", entryNumber: "CL-001", bundleNumber: "BND-001", poMockId: "po-1", karigarMockId: "k-anwar", entryDate: "2024-01-22", colorApplied: "White", piecesReceived: 978, piecesReturned: 976, piecesRejected: 2 },
    { mockId: "cl-2", entryNumber: "CL-002", bundleNumber: "BND-002", poMockId: "po-2", karigarMockId: "k-anwar", entryDate: "2024-01-23", colorApplied: "Blue", piecesReceived: 965, piecesReturned: 962, piecesRejected: 3 },
    { mockId: "cl-3", entryNumber: "CL-003", bundleNumber: "BND-003", poMockId: "po-1", karigarMockId: "k-anwar", entryDate: "2024-01-24", colorApplied: "Yellow", piecesReceived: 848, piecesReturned: 845, piecesRejected: 3 },
    { mockId: "cl-4", entryNumber: "CL-004", bundleNumber: "BND-004", poMockId: "po-3", karigarMockId: "k-amit-k", entryDate: "2024-01-25", colorApplied: "Pink", piecesReceived: 638, piecesReturned: 635, piecesRejected: 3 },
  ];

  for (const entry of coloringEntries) {
    const record = await prisma.coloringEntry.upsert({
      where: { entryNumber: entry.entryNumber },
      update: {
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        colorApplied: entry.colorApplied,
        piecesReceived: entry.piecesReceived,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
      create: {
        entryNumber: entry.entryNumber,
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        entryDate: date(entry.entryDate),
        colorApplied: entry.colorApplied,
        piecesReceived: entry.piecesReceived,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
    });
    coloringEntryIds.set(entry.mockId, record.id);
  }

  const stitchingEntries = [
    { mockId: "st-1", entryNumber: "ST-8821", bundleNumber: "BNDL-004", poMockId: "po-1", karigarMockId: "k-rashid", operationMockId: "prod-op-side", entryDate: "2024-05-24", piecesGiven: 420, piecesReturned: 418, piecesRejected: 2 },
    { mockId: "st-2", entryNumber: "ST-8822", bundleNumber: "BNDL-005", poMockId: "po-2", karigarMockId: "k-salim", operationMockId: "prod-op-sleeve", entryDate: "2024-05-24", piecesGiven: 400, piecesReturned: 400, piecesRejected: 0 },
    { mockId: "st-3", entryNumber: "ST-8823", bundleNumber: "BNDL-006", poMockId: "po-1", karigarMockId: "k-rashid", operationMockId: "prod-op-collar", entryDate: "2024-05-23", piecesGiven: 380, piecesReturned: 377, piecesRejected: 3 },
    { mockId: "st-4", entryNumber: "ST-8824", bundleNumber: "BNDL-007", poMockId: "po-3", karigarMockId: "k-amit-k", operationMockId: "prod-op-overlock", entryDate: "2024-05-22", piecesGiven: 420, piecesReturned: 418, piecesRejected: 2 },
    { mockId: "st-5", entryNumber: "ST-8825", bundleNumber: "BNDL-008", poMockId: "po-2", karigarMockId: "k-salim", operationMockId: "prod-op-bottom", entryDate: "2024-05-21", piecesGiven: 360, piecesReturned: 360, piecesRejected: 0 },
  ];

  for (const entry of stitchingEntries) {
    const record = await prisma.stitchingEntry.upsert({
      where: { entryNumber: entry.entryNumber },
      update: {
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        operationId: operationIds.get(entry.operationMockId)!,
        entryDate: date(entry.entryDate),
        piecesGiven: entry.piecesGiven,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
      create: {
        entryNumber: entry.entryNumber,
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        operationId: operationIds.get(entry.operationMockId)!,
        entryDate: date(entry.entryDate),
        piecesGiven: entry.piecesGiven,
        piecesReturned: entry.piecesReturned,
        piecesRejected: entry.piecesRejected,
      },
    });
    stitchingEntryIds.set(entry.mockId, record.id);
  }

  const finishingEntries = [
    { mockId: "fn-1", entryNumber: "FN-001", bundleNumber: "BND-001", poMockId: "po-1", karigarMockId: "k-anita", operationMockId: "prod-op-iron", entryDate: "2024-01-25", piecesReceived: 974, piecesCompleted: 974 },
    { mockId: "fn-2", entryNumber: "FN-002", bundleNumber: "BND-001", poMockId: "po-1", karigarMockId: "k-anita", operationMockId: "prod-op-poly", entryDate: "2024-01-25", piecesReceived: 974, piecesCompleted: 974 },
    { mockId: "fn-3", entryNumber: "FN-003", bundleNumber: "BND-002", poMockId: "po-2", karigarMockId: "k-mohammad", operationMockId: "prod-op-iron", entryDate: "2024-01-26", piecesReceived: 960, piecesCompleted: 960 },
    { mockId: "fn-4", entryNumber: "FN-004", bundleNumber: "BND-002", poMockId: "po-2", karigarMockId: "k-anita", operationMockId: "prod-op-gift", entryDate: "2024-01-26", piecesReceived: 960, piecesCompleted: 958 },
    { mockId: "fn-5", entryNumber: "FN-005", bundleNumber: "BND-003", poMockId: "po-3", karigarMockId: "k-mohammad", operationMockId: "prod-op-hanger", entryDate: "2024-01-27", piecesReceived: 960, piecesCompleted: 958 },
  ];

  for (const entry of finishingEntries) {
    const record = await prisma.finishingEntry.upsert({
      where: { entryNumber: entry.entryNumber },
      update: {
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        operationId: operationIds.get(entry.operationMockId)!,
        entryDate: date(entry.entryDate),
        piecesReceived: entry.piecesReceived,
        piecesCompleted: entry.piecesCompleted,
      },
      create: {
        entryNumber: entry.entryNumber,
        bundleId: bundleIds.get(entry.bundleNumber)!,
        poId: poIds.get(entry.poMockId)!,
        karigarId: partyIds.get(entry.karigarMockId)!,
        operationId: operationIds.get(entry.operationMockId)!,
        entryDate: date(entry.entryDate),
        piecesReceived: entry.piecesReceived,
        piecesCompleted: entry.piecesCompleted,
      },
    });
    finishingEntryIds.set(entry.mockId, record.id);
  }
  console.log("✓ Production entries");

  // ─── Karigar payments ─────────────────────────────────────────
  const karigarPayments = [
    {
      paymentNumber: "PAY-8821",
      karigarMockId: "party-extra-1",
      poMockId: "po-1",
      operationMockId: "op-7",
      productionEntryType: "STITCHING" as const,
      productionEntryMockId: "st-1",
      piecesCompleted: 240,
      ratePerPiece: 12,
      amountDue: 2880,
      weekNumber: 42,
      year: 2024,
      status: "PENDING" as const,
      paidAt: null as string | null,
      paymentMode: null as string | null,
      referenceNo: null as string | null,
    },
    {
      paymentNumber: "PAY-8820",
      karigarMockId: "party-6",
      poMockId: "po-2",
      operationMockId: "op-5",
      productionEntryType: "STITCHING" as const,
      productionEntryMockId: "st-2",
      piecesCompleted: 418,
      ratePerPiece: 1,
      amountDue: 418,
      weekNumber: 42,
      year: 2024,
      status: "PENDING" as const,
      paidAt: null,
      paymentMode: null,
      referenceNo: null,
    },
    {
      paymentNumber: "PAY-8819",
      karigarMockId: "party-7",
      poMockId: "po-1",
      operationMockId: "op-6",
      productionEntryType: "STITCHING" as const,
      productionEntryMockId: "st-3",
      piecesCompleted: 320,
      ratePerPiece: 8,
      amountDue: 2560,
      weekNumber: 42,
      year: 2024,
      status: "PENDING" as const,
      paidAt: null,
      paymentMode: null,
      referenceNo: null,
    },
    {
      paymentNumber: "PAY-8818",
      karigarMockId: "party-6",
      poMockId: "po-3",
      operationMockId: "op-9",
      productionEntryType: "FINISHING" as const,
      productionEntryMockId: "fn-1",
      piecesCompleted: 500,
      ratePerPiece: 2,
      amountDue: 1000,
      weekNumber: 41,
      year: 2024,
      status: "PAID" as const,
      paidAt: "2024-05-18",
      paymentMode: "UPI",
      referenceNo: "UPI-4412901",
    },
    {
      paymentNumber: "PAY-8817",
      karigarMockId: "party-7",
      poMockId: "po-2",
      operationMockId: "op-5",
      productionEntryType: "STITCHING" as const,
      productionEntryMockId: "st-4",
      piecesCompleted: 600,
      ratePerPiece: 4.5,
      amountDue: 2700,
      weekNumber: 41,
      year: 2024,
      status: "PAID" as const,
      paidAt: "2024-05-15",
      paymentMode: "Cash",
      referenceNo: null,
    },
    {
      paymentNumber: "PAY-8816",
      karigarMockId: "party-extra-1",
      poMockId: "po-4",
      operationMockId: "op-10",
      productionEntryType: "FINISHING" as const,
      productionEntryMockId: "fn-2",
      piecesCompleted: 280,
      ratePerPiece: 3,
      amountDue: 840,
      weekNumber: 42,
      year: 2024,
      status: "PENDING" as const,
      paidAt: null,
      paymentMode: null,
      referenceNo: null,
    },
    {
      paymentNumber: "PAY-8815",
      karigarMockId: "party-6",
      poMockId: "po-1",
      operationMockId: "op-4",
      productionEntryType: "COLORING" as const,
      productionEntryMockId: "cl-1",
      piecesCompleted: 150,
      ratePerPiece: 6,
      amountDue: 900,
      weekNumber: 40,
      year: 2024,
      status: "PAID" as const,
      paidAt: "2024-05-10",
      paymentMode: "Bank Transfer",
      referenceNo: "NEFT-99210",
    },
    {
      paymentNumber: "PAY-8814",
      karigarMockId: "party-7",
      poMockId: "po-2",
      operationMockId: "op-7",
      productionEntryType: "STITCHING" as const,
      productionEntryMockId: "st-5",
      piecesCompleted: 236,
      ratePerPiece: 5,
      amountDue: 1180,
      weekNumber: 42,
      year: 2024,
      status: "PENDING" as const,
      paidAt: null,
      paymentMode: null,
      referenceNo: null,
    },
  ];

  function resolveProductionEntryId(
    type: "CUTTING" | "PRINTING" | "COLORING" | "STITCHING" | "FINISHING",
    mockId: string
  ): string {
    const map =
      type === "CUTTING"
        ? cuttingEntryIds
        : type === "PRINTING"
          ? printingEntryIds
          : type === "COLORING"
            ? coloringEntryIds
            : type === "STITCHING"
              ? stitchingEntryIds
              : finishingEntryIds;
    const id = map.get(mockId);
    if (!id) throw new Error(`Missing production entry ${type}/${mockId}`);
    return id;
  }

  for (const payment of karigarPayments) {
    await prisma.karigarPayment.upsert({
      where: { paymentNumber: payment.paymentNumber },
      update: {
        karigarId: partyIds.get(payment.karigarMockId)!,
        poId: poIds.get(payment.poMockId)!,
        operationId: operationIds.get(payment.operationMockId)!,
        productionEntryType: payment.productionEntryType,
        productionEntryId: resolveProductionEntryId(
          payment.productionEntryType,
          payment.productionEntryMockId
        ),
        piecesCompleted: payment.piecesCompleted,
        ratePerPiece: d(payment.ratePerPiece),
        amountDue: d(payment.amountDue),
        weekNumber: payment.weekNumber,
        year: payment.year,
        status: payment.status,
        paidAt: payment.paidAt ? date(payment.paidAt) : null,
        paymentMode: payment.paymentMode,
        referenceNo: payment.referenceNo,
      },
      create: {
        paymentNumber: payment.paymentNumber,
        karigarId: partyIds.get(payment.karigarMockId)!,
        poId: poIds.get(payment.poMockId)!,
        operationId: operationIds.get(payment.operationMockId)!,
        productionEntryType: payment.productionEntryType,
        productionEntryId: resolveProductionEntryId(
          payment.productionEntryType,
          payment.productionEntryMockId
        ),
        piecesCompleted: payment.piecesCompleted,
        ratePerPiece: d(payment.ratePerPiece),
        amountDue: d(payment.amountDue),
        weekNumber: payment.weekNumber,
        year: payment.year,
        status: payment.status,
        paidAt: payment.paidAt ? date(payment.paidAt) : null,
        paymentMode: payment.paymentMode,
        referenceNo: payment.referenceNo,
      },
    });
  }
  console.log(`✓ Karigar payments (${karigarPayments.length})`);

  // ─── Containers then boxes ────────────────────────────────────
  const containers = [
    {
      mockId: "ctn-1",
      containerNumber: "CTN-001",
      poMockId: "po-1",
      buyerMockId: "party-1",
      destination: "Dubai, UAE",
      dispatchDate: "2024-02-01",
      status: "DISPATCHED" as const,
    },
    {
      mockId: "ctn-2",
      containerNumber: "CTN-002",
      poMockId: "po-2",
      buyerMockId: "party-2",
      destination: "Dubai, UAE",
      dispatchDate: null as string | null,
      status: "LOADING" as const,
    },
    {
      mockId: "ctn-3",
      containerNumber: "CTN-003",
      poMockId: "po-3",
      buyerMockId: "party-1",
      destination: "Riyadh, KSA",
      dispatchDate: null,
      status: "READY" as const,
    },
    {
      mockId: "ctn-4",
      containerNumber: "CTN-004",
      poMockId: "po-4",
      buyerMockId: "party-1",
      destination: "Abu Dhabi, UAE",
      dispatchDate: null,
      status: "LOADING" as const,
    },
  ];

  for (const ctn of containers) {
    const record = await prisma.container.upsert({
      where: { containerNumber: ctn.containerNumber },
      update: {
        poId: poIds.get(ctn.poMockId)!,
        buyerId: partyIds.get(ctn.buyerMockId)!,
        destination: ctn.destination,
        dispatchDate: ctn.dispatchDate ? date(ctn.dispatchDate) : null,
        status: ctn.status,
      },
      create: {
        containerNumber: ctn.containerNumber,
        poId: poIds.get(ctn.poMockId)!,
        buyerId: partyIds.get(ctn.buyerMockId)!,
        destination: ctn.destination,
        dispatchDate: ctn.dispatchDate ? date(ctn.dispatchDate) : null,
        status: ctn.status,
      },
    });
    containerIds.set(ctn.mockId, record.id);
  }

  const boxes = [
    {
      mockId: "box-1",
      boxNumber: "BOX-001",
      poMockId: "po-1",
      designNumber: "D-42",
      color: "White",
      sizes: { qty_0_3M: 10, qty_3_6M: 10, qty_6_9M: 10, qty_9_12M: 10, qty_12_18M: 10, qty_18_24M: 10 },
      totalPieces: 60,
      containerMockId: "ctn-1",
      status: "LOADED" as const,
    },
    {
      mockId: "box-2",
      boxNumber: "BOX-002",
      poMockId: "po-1",
      designNumber: "D-42",
      color: "White",
      sizes: { qty_0_3M: 12, qty_3_6M: 12, qty_6_9M: 12, qty_9_12M: 8, qty_12_18M: 8, qty_18_24M: 8 },
      totalPieces: 60,
      containerMockId: "ctn-1",
      status: "LOADED" as const,
    },
    {
      mockId: "box-3",
      boxNumber: "BOX-003",
      poMockId: "po-1",
      designNumber: "D-41",
      color: "Yellow",
      sizes: { qty_0_3M: 15, qty_3_6M: 15, qty_6_9M: 10, qty_9_12M: 10, qty_12_18M: 5, qty_18_24M: 5 },
      totalPieces: 60,
      containerMockId: "ctn-1",
      status: "LOADED" as const,
    },
    {
      mockId: "box-4",
      boxNumber: "BOX-004",
      poMockId: "po-2",
      designNumber: "D-43",
      color: "Blue",
      sizes: { qty_0_3M: 10, qty_3_6M: 10, qty_6_9M: 10, qty_9_12M: 10, qty_12_18M: 10, qty_18_24M: 10 },
      totalPieces: 60,
      containerMockId: null as string | null,
      status: "PACKED" as const,
    },
    {
      mockId: "box-5",
      boxNumber: "BOX-005",
      poMockId: "po-2",
      designNumber: "D-43",
      color: "Blue",
      sizes: { qty_0_3M: 8, qty_3_6M: 12, qty_6_9M: 12, qty_9_12M: 12, qty_12_18M: 8, qty_18_24M: 8 },
      totalPieces: 60,
      containerMockId: null,
      status: "PACKED" as const,
    },
    {
      mockId: "box-6",
      boxNumber: "BOX-006",
      poMockId: "po-3",
      designNumber: "D-55",
      color: "Pink",
      sizes: { qty_0_3M: 5, qty_3_6M: 5, qty_6_9M: 10, qty_9_12M: 10, qty_12_18M: 15, qty_18_24M: 15 },
      totalPieces: 60,
      containerMockId: null,
      status: "PACKED" as const,
    },
  ];

  for (const box of boxes) {
    const record = await prisma.boxPacking.upsert({
      where: { boxNumber: box.boxNumber },
      update: {
        poId: poIds.get(box.poMockId)!,
        designNumber: box.designNumber,
        color: box.color,
        ...box.sizes,
        totalPieces: box.totalPieces,
        containerId: box.containerMockId ? containerIds.get(box.containerMockId)! : null,
        status: box.status,
      },
      create: {
        boxNumber: box.boxNumber,
        poId: poIds.get(box.poMockId)!,
        designNumber: box.designNumber,
        color: box.color,
        ...box.sizes,
        totalPieces: box.totalPieces,
        containerId: box.containerMockId ? containerIds.get(box.containerMockId)! : null,
        status: box.status,
      },
    });
    boxIds.set(box.mockId, record.id);
  }
  console.log(`✓ Containers (${containers.length}) + boxes (${boxes.length})`);

  // ─── Sales bills ──────────────────────────────────────────────
  const salesBills = [
    {
      mockId: "sb-1",
      invoiceNumber: "INV-2024-001",
      poMockId: "po-1",
      buyerMockId: "party-1",
      containerMockId: "ctn-1",
      invoiceDate: "2024-01-20",
      buyerPoReference: "AR/2024/001",
      paymentTerms: "CIF, 60 Days",
      shippingDestination: "Dubai, UAE",
      currency: "USD",
      exchangeRate: 83.14,
      subTotal: 384000,
      gstAmount: 0,
      netTotal: 384000,
      status: "PAID" as const,
      submittedAt: "2024-01-20T00:00:00.000Z",
      items: [
        { designNumber: "D-42", garmentType: "Premium Twill Fabric - Navy Blue", color: "Navy", size: "—", quantity: 1200, ratePerPiece: 120, amount: 144000 },
        { designNumber: "D-41", garmentType: "Egyptian Cotton Blend - White", color: "White", size: "—", quantity: 800, ratePerPiece: 150, amount: 120000 },
        { designNumber: "THR-01", garmentType: "Industrial Stitching Thread - Black", color: "Black", size: "—", quantity: 500, ratePerPiece: 60, amount: 30000 },
        { designNumber: "CNV-01", garmentType: "Reinforced Canvas Linings", color: "Natural", size: "—", quantity: 450, ratePerPiece: 200, amount: 90000 },
      ],
    },
    {
      mockId: "sb-2",
      invoiceNumber: "INV-2024-002",
      poMockId: "po-2",
      buyerMockId: "party-2",
      containerMockId: "ctn-2",
      invoiceDate: "2024-10-12",
      buyerPoReference: "BW/2024/UAE-09",
      paymentTerms: "CIF, 60 Days",
      shippingDestination: "Dubai, UAE",
      currency: "USD",
      exchangeRate: 83.14,
      subTotal: 420000,
      gstAmount: 0,
      netTotal: 420000,
      status: "PAID" as const,
      submittedAt: "2024-10-12T00:00:00.000Z",
      items: [],
    },
    {
      mockId: "sb-3",
      invoiceNumber: "INV-2024-003",
      poMockId: "po-1",
      buyerMockId: "party-1",
      containerMockId: "ctn-3",
      invoiceDate: "2024-10-15",
      buyerPoReference: "AR/2024/003",
      paymentTerms: "CIF, 60 Days",
      shippingDestination: "Dubai, UAE",
      currency: "USD",
      exchangeRate: 83.14,
      subTotal: 280000,
      gstAmount: 0,
      netTotal: 280000,
      status: "SUBMITTED" as const,
      submittedAt: "2024-10-15T00:00:00.000Z",
      items: [],
    },
    {
      mockId: "sb-4",
      invoiceNumber: "INV-2024-004",
      poMockId: "po-3",
      buyerMockId: "party-1",
      containerMockId: null as string | null,
      invoiceDate: "2024-10-18",
      buyerPoReference: "Ref: SE-291-K",
      paymentTerms: "LC at Sight / 60 Days",
      shippingDestination: "Stockholm, SE",
      currency: "USD",
      exchangeRate: 83.14,
      subTotal: 41000,
      gstAmount: 0,
      netTotal: 41000,
      status: "DRAFT" as const,
      submittedAt: null as string | null,
      items: [],
    },
    {
      mockId: "sb-5",
      invoiceNumber: "INV-2024-005",
      poMockId: "po-2",
      buyerMockId: "party-2",
      containerMockId: "ctn-4",
      invoiceDate: "2024-09-28",
      buyerPoReference: "BW/2024/UAE-12",
      paymentTerms: "CIF, 60 Days",
      shippingDestination: "Dubai, UAE",
      currency: "USD",
      exchangeRate: 83.0,
      subTotal: 195000,
      gstAmount: 0,
      netTotal: 195000,
      status: "SUBMITTED" as const,
      submittedAt: "2024-09-28T00:00:00.000Z",
      items: [],
    },
    {
      mockId: "sb-6",
      invoiceNumber: "INV-2024-006",
      poMockId: "po-4",
      buyerMockId: "party-1",
      containerMockId: null,
      invoiceDate: "2024-08-10",
      buyerPoReference: "AR/2024/008",
      paymentTerms: "CIF, 60 Days",
      shippingDestination: "Dubai, UAE",
      currency: "USD",
      exchangeRate: 82.5,
      subTotal: 150000,
      gstAmount: 0,
      netTotal: 150000,
      status: "RETURNED" as const,
      submittedAt: "2024-08-10T00:00:00.000Z",
      items: [],
    },
  ];

  for (const bill of salesBills) {
    const record = await prisma.salesBill.upsert({
      where: { invoiceNumber: bill.invoiceNumber },
      update: {
        poId: poIds.get(bill.poMockId)!,
        buyerId: partyIds.get(bill.buyerMockId)!,
        containerId: bill.containerMockId ? containerIds.get(bill.containerMockId)! : null,
        invoiceDate: date(bill.invoiceDate),
        buyerPoReference: bill.buyerPoReference,
        paymentTerms: bill.paymentTerms,
        shippingDestination: bill.shippingDestination,
        currency: bill.currency,
        exchangeRate: d(bill.exchangeRate),
        subTotal: d(bill.subTotal),
        gstAmount: d(bill.gstAmount),
        netTotal: d(bill.netTotal),
        status: bill.status,
        submittedAt: bill.submittedAt ? date(bill.submittedAt) : null,
      },
      create: {
        invoiceNumber: bill.invoiceNumber,
        poId: poIds.get(bill.poMockId)!,
        buyerId: partyIds.get(bill.buyerMockId)!,
        containerId: bill.containerMockId ? containerIds.get(bill.containerMockId)! : null,
        invoiceDate: date(bill.invoiceDate),
        buyerPoReference: bill.buyerPoReference,
        paymentTerms: bill.paymentTerms,
        shippingDestination: bill.shippingDestination,
        currency: bill.currency,
        exchangeRate: d(bill.exchangeRate),
        subTotal: d(bill.subTotal),
        gstAmount: d(bill.gstAmount),
        netTotal: d(bill.netTotal),
        status: bill.status,
        submittedAt: bill.submittedAt ? date(bill.submittedAt) : null,
      },
    });
    salesBillIds.set(bill.mockId, record.id);

    await prisma.salesBillItem.deleteMany({ where: { salesBillId: record.id } });
    for (const item of bill.items) {
      await prisma.salesBillItem.create({
        data: {
          salesBillId: record.id,
          designNumber: item.designNumber,
          garmentType: item.garmentType,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          ratePerPiece: d(item.ratePerPiece),
          amount: d(item.amount),
        },
      });
    }
  }
  console.log(`✓ Sales bills (${salesBills.length})`);

  // ─── Vouchers ─────────────────────────────────────────────────
  const vouchers = [
    { voucherNumber: "VCH-001", type: "PAYMENT" as const, partyDescription: "Electricity Bill", amount: 8200, paymentMode: "Bank Transfer", referenceNo: "NEFT-001", date: "2024-01-15" },
    { voucherNumber: "VCH-002", type: "RECEIPT" as const, partyDescription: "Al Reem Trading", amount: 384000, paymentMode: "Wire Transfer", referenceNo: "WT-AR-001", date: "2024-01-22" },
    { voucherNumber: "VCH-003", type: "PAYMENT" as const, partyDescription: "Factory Rent", amount: 45000, paymentMode: "Bank Transfer", referenceNo: "NEFT-088", date: "2024-01-25" },
    { voucherNumber: "VCH-004", type: "RECEIPT" as const, partyDescription: "Baby World LLC", amount: 50000, paymentMode: "Wire Transfer", referenceNo: "WT-BW-004", date: "2024-02-01" },
    { voucherNumber: "VCH-005", type: "PAYMENT" as const, partyDescription: "Staff Advance — Cutting Floor", amount: 12000, paymentMode: "Cash", referenceNo: "—", date: "2024-02-05" },
    { voucherNumber: "VCH-006", type: "PAYMENT" as const, partyDescription: "Courier & Logistics", amount: 6400, paymentMode: "UPI", referenceNo: "UPI-5521", date: "2024-02-08" },
  ];

  for (const voucher of vouchers) {
    await prisma.voucher.upsert({
      where: { voucherNumber: voucher.voucherNumber },
      update: {
        type: voucher.type,
        partyDescription: voucher.partyDescription,
        amount: d(voucher.amount),
        paymentMode: voucher.paymentMode,
        referenceNo: voucher.referenceNo,
        date: date(voucher.date),
        createdById: admin.id,
      },
      create: {
        voucherNumber: voucher.voucherNumber,
        type: voucher.type,
        partyDescription: voucher.partyDescription,
        amount: d(voucher.amount),
        paymentMode: voucher.paymentMode,
        referenceNo: voucher.referenceNo,
        date: date(voucher.date),
        createdById: admin.id,
      },
    });
  }
  console.log(`✓ Vouchers (${vouchers.length})`);

  // ─── Ledger entries ───────────────────────────────────────────
  let supplierBalances = new Map<string, number>();
  for (const bill of purchaseBills.filter((b) => b.status === "CONFIRMED")) {
    const partyId = partyIds.get(bill.supplierMockId)!;
    const prev = supplierBalances.get(partyId) ?? 0;
    const balance = prev + bill.totalAmount;
    supplierBalances.set(partyId, balance);
    await upsertLedger({
      partyId,
      entryDate: date(bill.purchaseDate),
      description: `Purchase bill ${bill.billNumber}`,
      referenceType: "PURCHASE_BILL",
      referenceId: billIds.get(bill.mockId)!,
      debitAmount: 0,
      creditAmount: bill.totalAmount,
      balance,
    });
  }

  let buyerBalances = new Map<string, number>();
  for (const bill of salesBills.filter(
    (b) => b.status === "SUBMITTED" || b.status === "PAID"
  )) {
    const partyId = partyIds.get(bill.buyerMockId)!;
    const prev = buyerBalances.get(partyId) ?? 0;
    const balance = prev + bill.netTotal;
    buyerBalances.set(partyId, balance);
    await upsertLedger({
      partyId,
      entryDate: date(bill.invoiceDate),
      description: `Sales invoice ${bill.invoiceNumber}`,
      referenceType: "SALES_BILL",
      referenceId: salesBillIds.get(bill.mockId)!,
      debitAmount: bill.netTotal,
      creditAmount: 0,
      balance,
    });
  }
  console.log("✓ Ledger entries");

  console.log("Seed completed successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
