import PDFDocument from "pdfkit";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";

export type OrderInvoiceLine = {
  fuel: "Naafto" | "Basiin";
  quantity: string;
  unitPrice: string;
  amount: string;
};

export type OrderInvoicePdfInput = {
  orderNo: string;
  orderDate: string;
  deliveryDate: string | null;
  createdBy: string;
  status: string;
  customer: { name: string; phone: string | null; location: string | null };
  deliveryLocation: string;
  lines: OrderInvoiceLine[];
  subtotal: string;
  discount: string;
  total: string;
  paid: string;
  remaining: string;
  deliveryPending: boolean;
  branding: ResolvedDocumentBranding;
};

const money = (value: string) => `$${value}`;

export async function createOrderInvoicePdf(input: OrderInvoicePdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 35, right: 38, bottom: 48, left: 38 }, bufferPages: true, info: { Title: `Order Invoice ${input.orderNo}`, Author: input.branding.companyName } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 38;
    const right = 557;
    const width = right - left;
    const columns = [30, 138, 104, 115, 132];
    let y = 0;
    let page = 0;

    const header = () => {
      if (page > 0) doc.addPage();
      page += 1;
      drawDocumentLogo(doc, input.branding, left, 35, 45, 32);
      doc.font("Helvetica-Bold").fontSize(17).fillColor("#111111").text("ORDER INVOICE", 325, 40, { width: right - 325, align: "right" });
      const details = [
        ["Order No", input.orderNo],
        ["Order Date", input.orderDate],
        ...(input.deliveryDate ? [["Delivery Date", input.deliveryDate]] : []),
        ["Created By", input.createdBy]
      ];
      let detailsY = 67;
      details.forEach(([label, value]) => {
        doc.font("Helvetica").fontSize(7.5).fillColor("#444444").text(`${label}:`, 372, detailsY, { width: 68 });
        doc.font("Helvetica").fontSize(7.5).fillColor("#111111").text(value, 442, detailsY, { width: 115, align: "right" });
        detailsY += 12;
      });
      doc.moveTo(left, 115).lineTo(right, 115).lineWidth(0.55).strokeColor("#777777").stroke();
      y = 132;
    };

    const sectionHeading = (label: string, x: number, atY: number) => {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#333333").text(label, x, atY);
    };

    const tableHeader = () => {
      doc.rect(left, y, width, 27).fill("#f3f3f3");
      const labels = ["#", "Fuel Type", "Quantity\n(Fuusto)", "Unit Price", "Amount"];
      let x = left;
      labels.forEach((label, index) => {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#111111").text(label, x + 5, y + 7, { width: columns[index]! - 10, align: index >= 2 ? "right" : "left", lineGap: 0 });
        x += columns[index]!;
      });
      y += 27;
    };

    const footerNotes = () => {
      const noteY = Math.max(y + 28, 500);
      doc.moveTo(left, noteY).lineTo(left + 245, noteY).strokeColor("#777777").lineWidth(0.45).stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#222222").text("NOTES", left, noteY + 9);
      doc.font("Helvetica").fontSize(7.5).fillColor("#333333").text("1. Please keep this invoice for your records.\n2. Thank you for your business.", left, noteY + 23, { lineGap: 3 });

      const signatureX = 348;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#222222").text("Received By", signatureX, noteY + 9);
      doc.moveTo(signatureX, noteY + 46).lineTo(right, noteY + 46).strokeColor("#777777").lineWidth(0.45).stroke();
      doc.font("Helvetica").fontSize(7.5).text("Customer Signature", signatureX + 49, noteY + 52, { width: 120, align: "center" });
      doc.text("Date:", signatureX, noteY + 71);
      doc.moveTo(signatureX + 29, noteY + 76).lineTo(right, noteY + 76).strokeColor("#777777").lineWidth(0.45).stroke();
    };

    header();
    sectionHeading("CUSTOMER INFORMATION", left, y);
    sectionHeading("ORDER INFORMATION", 303, y);
    doc.moveTo(290, y - 2).lineTo(290, y + 74).strokeColor("#aaaaaa").lineWidth(0.45).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(input.customer.name, left, y + 16, { width: 235, ellipsis: true });
    const customerMeta = [input.customer.phone, input.customer.location].filter(Boolean).join("  ·  ");
    if (customerMeta) doc.font("Helvetica").fontSize(8).fillColor("#333333").text(customerMeta, left, y + 35, { width: 235, ellipsis: true });

    const orderFacts = [["Delivery Location", input.deliveryLocation], ["Order Status", input.status]];
    let factsY = y + 17;
    orderFacts.forEach(([label, value]) => {
      doc.font("Helvetica").fontSize(7.5).fillColor("#333333").text(`${label}:`, 303, factsY, { width: 80 });
      doc.font("Helvetica").fontSize(7.5).fillColor("#111111").text(value, 385, factsY, { width: 172, ellipsis: true });
      factsY += 16;
    });
    y += 99;
    tableHeader();

    for (const [index, line] of input.lines.entries()) {
      const rowHeight = 27;
      if (y + rowHeight > 556) {
        header();
        tableHeader();
      }
      doc.rect(left, y, width, rowHeight).strokeColor("#d4d4d4").lineWidth(0.4).stroke();
      const values = [String(index + 1), line.fuel, `${line.quantity} Fuusto`, money(line.unitPrice), money(line.amount)];
      let x = left;
      values.forEach((value, cell) => {
        doc.font("Helvetica").fontSize(8).fillColor("#111111").text(value, x + 5, y + 9, { width: columns[cell]! - 10, align: cell >= 2 ? "right" : "left" });
        x += columns[cell]!;
      });
      y += rowHeight;
    }

    const summaryX = 355;
    const summaryWidth = right - summaryX;
    const summaryRow = (label: string, value: string, emphasis = false) => {
      doc.font(emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(emphasis ? 10.5 : 8).fillColor("#111111").text(label, summaryX, y + 7, { width: 92 });
      doc.font(emphasis ? "Helvetica-Bold" : "Helvetica").fontSize(emphasis ? 10.5 : 8).text(money(value), summaryX + 94, y + 7, { width: summaryWidth - 94, align: "right" });
      y += emphasis ? 29 : 19;
    };
    y += 12;
    summaryRow("Subtotal:", input.subtotal);
    if (input.discount !== "0.00") summaryRow("Discount:", input.discount);
    doc.moveTo(summaryX, y + 1).lineTo(right, y + 1).strokeColor("#777777").lineWidth(0.5).stroke();
    y += 3;
    doc.rect(summaryX, y, summaryWidth, 29).fill("#f0f0f0");
    summaryRow("TOTAL:", input.total, true);
    if (input.paid !== "0.00") {
      summaryRow("Paid Amount:", input.paid);
      doc.moveTo(summaryX, y + 1).lineTo(right, y + 1).strokeColor("#777777").lineWidth(0.5).stroke();
      y += 3;
      doc.rect(summaryX, y, summaryWidth, 29).fill("#f0f0f0");
      summaryRow("REMAINING:", input.remaining, true);
    }
    if (input.deliveryPending) {
      doc.font("Helvetica").fontSize(7.5).fillColor("#444444").text("Delivery pending — this document shows the agreed order, not a final delivered sale.", left, y + 8, { width: 300 });
      y += 22;
    }

    footerNotes();
    addDocumentFooter(doc, input.branding);
    doc.end();
  });
}
