import PDFDocument from "pdfkit";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";
import { somaliLabel } from "./somali-labels.js";

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
  const doc = new PDFDocument({ size: "A4", margins: { top: 35, right: 38, bottom: 48, left: 38 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const left = 38;
    const right = 557;
    const width = right - left;
    const columns = [25, 65, 50, 72, 157, 75, 75];
    const labels = ["#", "Taariikh", "Nooca", "Tixraac", "Sharaxaad", "Lacagta", "Haraag"];
    let page = 0;
    let y = 0;

    const pageHeader = () => {
      if (page > 0) doc.addPage();
      page += 1;
      drawDocumentLogo(doc, input.branding, left, 35, 45, 32);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#111111").text("WARBIXINTA XISAABTA MACMIILKA", 297, 41, { width: 260, align: "right" });
      doc.font("Helvetica").fontSize(7).fillColor("#444444").text(`Muddada: ${input.period}`, 297, 60, { width: 260, align: "right" });
      doc.text(`La diyaariyey: ${input.generatedAt}`, 297, 71, { width: 260, align: "right" });
      doc.moveTo(left, 99).lineTo(right, 99).strokeColor("#777777").lineWidth(0.55).stroke();
      y = 117;
    };
    const tableHeader = () => {
      doc.rect(left, y, width, 25).fill("#f3f3f3");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#111111");
      let x = left;
      labels.forEach((label, index) => { doc.text(label, x + 4, y + 9, { width: columns[index]! - 8, align: index > 4 ? "right" : "left" }); x += columns[index]!; });
      y += 25;
    };
    const ensure = (height: number) => { if (y + height > 655) { pageHeader(); tableHeader(); } };

    pageHeader();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#333333").text("MACMIILKA", left, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(input.customer.name, left, y + 17, { width: 235, ellipsis: true });
    const customerMeta = [input.customer.phone, input.customer.location].filter(Boolean).join("  ·  ");
    if (customerMeta) doc.font("Helvetica").fontSize(7.5).fillColor("#333333").text(customerMeta, left, y + 37, { width: 235, ellipsis: true });
    doc.moveTo(279, y - 2).lineTo(279, y + 85).strokeColor("#bbbbbb").lineWidth(0.45).stroke();
    const summary: Array<[string, string]> = [
      ["Deyntii Bilowga", input.openingDebt], ["Wadarta Iibka", input.totalSales], ["Wadarta Lacag-bixinnada", input.totalPaid],
      ["Deynta Hadda", input.remainingDebt], ["Dalabyada Sugaya", input.pendingOrderRemaining]
    ];
    let summaryY = y;
    summary.forEach(([label, value], index) => {
      const bold = index === 3;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8.5 : 7.5).fillColor("#222222").text(label, 300, summaryY, { width: 110 });
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 8.5 : 7.5).text(`$${value}`, 414, summaryY, { width: 143, align: "right" });
      summaryY += 16;
      if (index === 2) doc.moveTo(300, summaryY - 4).lineTo(right, summaryY - 4).strokeColor("#777777").lineWidth(0.45).stroke();
    });
    y += 104;
    if (!/^0(?:\.0+)?$/.test(input.moneyToReview)) {
      doc.font("Helvetica").fontSize(7.5).fillColor("#333333").text(`Milkiiluhu waa inuu hubiyaa: $${input.moneyToReview}`, left, y - 10, { width });
    }
    tableHeader();

    if (!input.orders.length) {
      doc.rect(left, y, width, 34).strokeColor("#d4d4d4").lineWidth(0.4).stroke();
      doc.font("Helvetica").fontSize(8).fillColor("#555555").text("Muddadan wax dhaqdhaqaaq dalab ahi ma jiro.", left + 8, y + 13, { width: width - 16, align: "center" });
      y += 34;
    }
    let record = 0;
    const drawRow = (values: string[], height = 26) => {
      ensure(height);
      doc.rect(left, y, width, height).strokeColor("#d4d4d4").lineWidth(0.4).stroke();
      let x = left;
      values.forEach((value, index) => {
        doc.font(index === 3 ? "Helvetica-Bold" : "Helvetica").fontSize(7).fillColor("#222222").text(value, x + 4, y + 8, { width: columns[index]! - 8, align: index > 4 ? "right" : "left", lineGap: 1, ellipsis: true });
        x += columns[index]!;
      });
      y += height;
    };
    for (const order of input.orders) {
      record += 1;
      const hasSale = !/^0(?:\.0+)?$/.test(order.acceptedSale);
      const description = hasSale ? `${somaliLabel(order.fuel)} iib la geeyey` : `Dalabka ${somaliLabel(order.fuel)} — gaarsiin sugaysa`;
      const balance = order.remainingLabel === "Settled" ? "La Bixiyey" : `${somaliLabel(order.remainingLabel)} $${order.remaining}`;
      drawRow([String(record), order.date, hasSale ? "Iib" : "Dalab", order.orderNo, description, hasSale ? `$${order.acceptedSale}` : "—", balance], 26);
      for (const payment of order.payments) {
        record += 1;
        drawRow([String(record), payment.date, "Lacag-bixin", payment.reference, payment.status === "Reversed" ? "Lacag-bixinta waa laga noqday" : "Lacagta waa la qabtay", payment.status === "Reversed" ? "—" : `$${payment.amount}`, balance], 26);
      }
    }

    const notesY = Math.max(y + 28, 620);
    doc.moveTo(left, notesY).lineTo(left + 225, notesY).strokeColor("#777777").lineWidth(0.45).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#222222").text("FAAHFAAHIN", left, notesY + 9);
    doc.font("Helvetica").fontSize(7.2).fillColor("#333333").text("• Iibka la geeyey ayaa noqda deynta macmiilka.\n• Dalabyada sugaya way ka go'an yihiin deynta ilaa gaarsiinta la aqbalo.", left, notesY + 23, { lineGap: 3 });
    doc.moveTo(386, notesY + 42).lineTo(right, notesY + 42).strokeColor("#777777").lineWidth(0.45).stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#333333").text("Waad ku mahadsan tahay!", 386, notesY + 50, { width: right - 386, align: "center" });
    addDocumentFooter(doc, input.branding);
    doc.end();
  });
}
