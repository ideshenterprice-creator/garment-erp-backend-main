import prisma from "@/config/database";
import { SearchQuery } from "./search.schema";

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export async function globalSearch(query: SearchQuery): Promise<{ results: SearchResult[] }> {
  const q = query.q;
  const take = query.limit;

  const [parties, products, karigars, pos, bills, sales, bundles, boxes, containers] =
    await Promise.all([
      prisma.party.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { partyNumber: { contains: q, mode: "insensitive" } },
            { gstNumber: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { contact: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, partyNumber: true, type: true },
        take,
      }),
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { productCode: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, productCode: true, category: true },
        take,
      }),
      prisma.party.findMany({
        where: {
          type: "KARIGAR",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { partyNumber: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, partyNumber: true },
        take,
      }),
      prisma.purchaseOrder.findMany({
        where: {
          OR: [
            { poNumber: { contains: q, mode: "insensitive" } },
            { buyerPoReference: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, poNumber: true, status: true, buyer: { select: { name: true } } },
        take,
      }),
      prisma.purchaseBill.findMany({
        where: {
          OR: [
            { billNumber: { contains: q, mode: "insensitive" } },
            { supplierInvoiceNo: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, billNumber: true, status: true, supplier: { select: { name: true } } },
        take,
      }),
      prisma.salesBill.findMany({
        where: { invoiceNumber: { contains: q, mode: "insensitive" } },
        select: { id: true, invoiceNumber: true, status: true, buyer: { select: { name: true } } },
        take,
      }),
      prisma.bundle.findMany({
        where: { bundleNumber: { contains: q, mode: "insensitive" } },
        select: { id: true, bundleNumber: true, currentStage: true, status: true },
        take,
      }),
      prisma.boxPacking.findMany({
        where: { boxNumber: { contains: q, mode: "insensitive" } },
        select: { id: true, boxNumber: true, designNumber: true, status: true },
        take,
      }),
      prisma.container.findMany({
        where: { containerNumber: { contains: q, mode: "insensitive" } },
        select: { id: true, containerNumber: true, destination: true, status: true },
        take,
      }),
    ]);

  const results: SearchResult[] = [
    ...parties.map((row) => ({
      type: "PARTY",
      id: row.id,
      title: row.name,
      subtitle: `${row.type} · ${row.partyNumber}`,
      href: `/masters/party/${row.id}`,
    })),
    ...products.map((row) => ({
      type: "PRODUCT",
      id: row.id,
      title: row.name,
      subtitle: `${row.productCode} · ${row.category}`,
      href: `/masters/product/${row.id}`,
    })),
    ...karigars.map((row) => ({
      type: "KARIGAR",
      id: row.id,
      title: row.name,
      subtitle: row.partyNumber,
      href: `/masters/karigar/${row.id}`,
    })),
    ...pos.map((row) => ({
      type: "PURCHASE_ORDER",
      id: row.id,
      title: row.poNumber,
      subtitle: `${row.buyer.name} · ${row.status}`,
      href: `/purchase-orders/${row.id}`,
    })),
    ...bills.map((row) => ({
      type: "PURCHASE_BILL",
      id: row.id,
      title: row.billNumber,
      subtitle: `${row.supplier.name} · ${row.status}`,
      href: `/purchase/bills/${row.id}`,
    })),
    ...sales.map((row) => ({
      type: "SALES_BILL",
      id: row.id,
      title: row.invoiceNumber,
      subtitle: `${row.buyer.name} · ${row.status}`,
      href: `/sales/bills/${row.id}`,
    })),
    ...bundles.map((row) => ({
      type: "BUNDLE",
      id: row.id,
      title: row.bundleNumber,
      subtitle: `${row.currentStage} · ${row.status}`,
      href: `/production/bundles/${row.bundleNumber}`,
    })),
    ...boxes.map((row) => ({
      type: "BOX",
      id: row.id,
      title: row.boxNumber,
      subtitle: `${row.designNumber} · ${row.status}`,
      href: `/boxing/boxes`,
    })),
    ...containers.map((row) => ({
      type: "CONTAINER",
      id: row.id,
      title: row.containerNumber,
      subtitle: `${row.destination} · ${row.status}`,
      href: `/boxing/containers/${row.id}`,
    })),
  ];

  return { results: results.slice(0, take * 3) };
}
