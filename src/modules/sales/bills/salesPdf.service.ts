import PDFDocument from "pdfkit";
import { companyProfile } from "@/config/env";

interface SalesPdfItem {
  designNumber: string;
  garmentType: string;
  color: string;
  size: string;
  quantity: number;
  ratePerPiece: number;
  amount: number;
}

interface SalesPdfInput {
  invoiceNumber: string;
  invoiceDate: Date;
  currency: string;
  buyer: {
    name: string;
    contact?: string | null;
    gstNumber?: string | null;
    city?: string | null;
    country?: string | null;
  };
  shippingDestination?: string | null;
  paymentTerms?: string | null;
  items: SalesPdfItem[];
  subTotal: number;
  gstAmount: number;
  netTotal: number;
  amountPaid: number;
  balance: number;
  status: string;
}

function money(value: number, currency: string): string {
  return `${currency} ${value.toFixed(2)}`;
}

export async function buildSalesBillPdf(input: SalesPdfInput): Promise<Buffer> {
  const company = companyProfile();
  const cgst = input.gstAmount > 0 && input.currency.toUpperCase() === "INR" ? Number((input.gstAmount / 2).toFixed(2)) : 0;
  const sgst = cgst;
  const igst = input.currency.toUpperCase() !== "INR" ? input.gstAmount : 0;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text(company.name);
    doc.fontSize(9).font("Helvetica").fillColor("#334155");
    if (company.address) doc.text(company.address);
    if (company.contact) doc.text(`Phone: ${company.contact}`);
    if (company.email) doc.text(`Email: ${company.email}`);
    if (company.gstin) doc.text(`GSTIN: ${company.gstin}`);

    doc.moveDown();
    doc.fillColor("#0f172a").fontSize(16).font("Helvetica-Bold").text("TAX INVOICE / SALES BILL");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Invoice No: ${input.invoiceNumber}`);
    doc.text(`Invoice Date: ${input.invoiceDate.toISOString().slice(0, 10)}`);
    doc.text(`Payment status: ${input.status}`);
    if (input.paymentTerms) doc.text(`Payment terms: ${input.paymentTerms}`);

    doc.moveDown();
    doc.font("Helvetica-Bold").text("Bill To");
    doc.font("Helvetica");
    doc.text(input.buyer.name);
    const addressParts = [input.buyer.city, input.buyer.country].filter(Boolean);
    if (addressParts.length) doc.text(addressParts.join(", "));
    if (input.buyer.contact) doc.text(input.buyer.contact);
    if (input.buyer.gstNumber) doc.text(`GSTIN: ${input.buyer.gstNumber}`);

    doc.moveDown();
    doc.font("Helvetica-Bold").text("Ship To");
    doc.font("Helvetica").text(input.shippingDestination || input.buyer.country || "—");

    doc.moveDown();
    const startY = doc.y;
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text("Product", 48, startY, { width: 90 });
    doc.text("Description", 138, startY, { width: 110 });
    doc.text("Qty", 248, startY, { width: 40 });
    doc.text("Rate", 288, startY, { width: 55 });
    doc.text("Taxable", 343, startY, { width: 55 });
    doc.text("Tax", 398, startY, { width: 50 });
    doc.text("Total", 448, startY, { width: 70 });

    let y = startY + 16;
    doc.font("Helvetica").fontSize(8);
    input.items.forEach((item) => {
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
      const lineTax = input.subTotal > 0 ? Number(((item.amount / input.subTotal) * input.gstAmount).toFixed(2)) : 0;
      doc.text(item.designNumber, 48, y, { width: 90 });
      doc.text(`${item.garmentType} ${item.color} ${item.size}`, 138, y, { width: 110 });
      doc.text(String(item.quantity), 248, y, { width: 40 });
      doc.text(item.ratePerPiece.toFixed(2), 288, y, { width: 55 });
      doc.text(item.amount.toFixed(2), 343, y, { width: 55 });
      doc.text(lineTax.toFixed(2), 398, y, { width: 50 });
      doc.text((item.amount + lineTax).toFixed(2), 448, y, { width: 70 });
      y += 16;
    });

    y += 12;
    doc.font("Helvetica").fontSize(10);
    doc.text(`Subtotal: ${money(input.subTotal, input.currency)}`, 360, y);
    y += 14;
    if (cgst > 0) {
      doc.text(`CGST: ${money(cgst, input.currency)}`, 360, y);
      y += 14;
      doc.text(`SGST: ${money(sgst, input.currency)}`, 360, y);
      y += 14;
    } else {
      doc.text(`IGST: ${money(igst, input.currency)}`, 360, y);
      y += 14;
    }
    doc.font("Helvetica-Bold").text(`Grand Total: ${money(input.netTotal, input.currency)}`, 360, y);
    y += 16;
    doc.font("Helvetica").text(`Amount paid: ${money(input.amountPaid, input.currency)}`, 360, y);
    y += 14;
    doc.text(`Balance: ${money(input.balance, input.currency)}`, 360, y);

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#64748b").text("Values on this invoice are calculated by the server and are the source of truth.", 48);

    doc.end();
  });
}
