import PDFDocument from "pdfkit";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";

export function compactPaymentReference(reference: string): string {
  const match = /^PAY-\d{13}-([a-f0-9]{8})$/i.exec(reference);
  return match ? `PAY-${match[1]!.toUpperCase()}` : reference;
}

export type CustomerStatementOrder = {
  date: string;
  orderNo: string;
  fuel: string;
  acceptedSale: string;
  paid: string;
  remaining: string;
  remainingLabel: "Debt" | "Order Remaining" | "Settled";
  payments: Array<{ date: string; reference: string; amount: string; status: string }>;
};

export async function createCustomerStatementPdf(input: {
  customer: { name: string; phone: string | null; location: string | null };
  period: string;
  generatedAt: string;
  openingDebt: string;
  closingDebt: string;
  totalSales: string;
  totalPaid: string;
  remainingDebt: string;
  pendingOrderRemaining: string;
  moneyToReview: string;
  orders: CustomerStatementOrder[];
  branding: ResolvedDocumentBranding;
}): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 34, right: 34, bottom: 42, left: 34 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const left = 34;
    const width = 527;
    const columns = [70, 85, 112, 82, 82, 96];
    const labels = ["Date", "Order", "Fuel", "Accepted Sale", "Paid", "Remaining"];
    let page = 0;
    let y = 0;

    const pageHeader = () => {
      if (page > 0) doc.addPage();
      page += 1;
      drawDocumentLogo(doc, input.branding, left, 34, 44, 38);
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111").text("CUSTOMER STATEMENT", 280, 38, { width: 281, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor("#444444").text(input.period, 280, 60, { width: 281, align: "right" });
      doc.text(`Generated ${input.generatedAt}`, 280, 73, { width: 281, align: "right" });
      doc.moveTo(left, 94).lineTo(left + width, 94).strokeColor("#777777").lineWidth(0.6).stroke();
      y = 108;
    };
    const tableHeader = () => {
      doc.rect(left, y, width, 24).fill("#eeeeee");
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#111111");
      let x = left;
      labels.forEach((label, index) => { doc.text(label, x + 5, y + 8, { width: columns[index]! - 10, align: index > 2 ? "right" : "left" }); x += columns[index]!; });
      y += 24;
    };
    const ensure = (height: number) => { if (y + height > 744) { pageHeader(); tableHeader(); } };

    pageHeader();
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111").text(input.customer.name, left, y);
    doc.font("Helvetica").fontSize(8).fillColor("#444444").text([input.customer.phone, input.customer.location].filter(Boolean).join(" · ") || "—", left, y + 19);
    y += 47;

    const summary = [
      ["Opening debt", input.openingDebt], ["Delivered sales", input.totalSales], ["Payments received", input.totalPaid],
      ["Remaining debt", input.remainingDebt], ["Pending orders", input.pendingOrderRemaining], ["Closing debt", input.closingDebt]
    ];
    const cellWidth = width / 3;
    summary.forEach(([label, value], index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = left + col * cellWidth;
      const sy = y + row * 39;
      doc.rect(x, sy, cellWidth, 39).strokeColor("#cccccc").lineWidth(0.35).stroke();
      doc.font("Helvetica").fontSize(7).fillColor("#555555").text(label!, x + 7, sy + 7, { width: cellWidth - 14 });
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text(`$${value}`, x + 7, sy + 20, { width: cellWidth - 14 });
    });
    y += 90;
    if (Number(input.moneyToReview) > 0) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#111111").text(`OWNER REVIEW NEEDED · $${input.moneyToReview}`, left, y, { width });
      y += 20;
    }
    tableHeader();

    if (!input.orders.length) {
      doc.rect(left, y, width, 38).strokeColor("#dddddd").stroke();
      doc.font("Helvetica").fontSize(8).fillColor("#555555").text("No order activity in this period.", left + 8, y + 14, { width: width - 16, align: "center" });
      y += 38;
    }
    for (const order of input.orders) {
      const paymentHeight = order.payments.length ? order.payments.length * 15 + 8 : 0;
      const rowHeight = 32 + paymentHeight;
      ensure(rowHeight);
      doc.rect(left, y, width, rowHeight).strokeColor("#d7d7d7").lineWidth(0.35).stroke();
      const values = [order.date, order.orderNo, order.fuel, `$${order.acceptedSale}`, `$${order.paid}`, `${order.remainingLabel}\n$${order.remaining}`];
      let x = left;
      values.forEach((value, index) => { doc.font(index === 1 ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor("#222222").text(value, x + 5, y + 7, { width: columns[index]! - 10, align: index > 2 ? "right" : "left", lineGap: 1 }); x += columns[index]!; });
      let py = y + 32;
      for (const payment of order.payments) {
        doc.font("Helvetica").fontSize(7).fillColor("#555555").text(`↳ ${payment.date}  ${payment.reference}`, left + columns[0]! + 5, py, { width: 270 });
        doc.font("Helvetica-Bold").text(`$${payment.amount} · ${payment.status}`, left + 385, py, { width: 130, align: "right" });
        py += 15;
      }
      y += rowHeight;
    }

    y += 18;
    ensure(54);
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor("#999999").lineWidth(0.5).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor("#444444").text("Debt includes delivered and posted sales only. Pending order amounts are shown separately until delivery is accepted.", left, y + 10, { width });
    addDocumentFooter(doc, input.branding);
    doc.end();
  });
}
