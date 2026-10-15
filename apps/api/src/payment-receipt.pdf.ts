import PDFDocument from "pdfkit";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";
import { somaliLabel } from "./somali-labels.js";

export type PaymentReceiptPdfInput = {
  receiptNo: string;
  paymentDate: string;
  status: "POSTED" | "REVERSED";
  customer: { name: string; phone: string | null };
  amount: string;
  method: string;
  reference: string | null;
  account: { name: string; identifierMasked: string | null } | null;
  collectedBy: string;
  order: { orderNo: string; total: string; paidThisTime: string; remainingPendingDelivery: string } | null;
  deliveredOrders: Array<{ invoiceNo: string; paid: string; remaining: string }>;
  branding: ResolvedDocumentBranding;
};

export async function createPaymentReceiptPdf(input: PaymentReceiptPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 36, right: 42, bottom: 24, left: 42 }, bufferPages: true, info: { Title: `Rasiidhka Lacagta ${input.receiptNo}`, Author: input.branding.companyName } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const left = 42; const right = 553; const width = right - left;

    drawDocumentLogo(doc, input.branding, left, 36, 46, 32);
    doc.font("Helvetica-Bold").fontSize(17).fillColor("#111111").text("RASIIDHKA LACAGTA", 300, 40, { width: 253, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor("#333333").text(`Lambarka Rasiidhka: ${input.receiptNo}\nTaariikh: ${input.paymentDate}`, 320, 67, { width: 233, align: "right", lineGap: 3 });
    doc.moveTo(left, 116).lineTo(right, 116).strokeColor("#777777").lineWidth(0.55).stroke();

    if (input.status === "REVERSED") {
      doc.save().rotate(-18, { origin: [298, 270] }).font("Helvetica-Bold").fontSize(54).fillColor("#d9d9d9").opacity(0.7).text("LAGA NOQDAY", 92, 235, { width: 415, align: "center" }).restore().opacity(1);
      doc.rect(left, 127, width, 26).fill("#ededed");
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text("WAA LAGA NOQDAY — RASIIDHKANI MAR DANBE MA SHAQAYNAYO.", left + 8, 136, { width: width - 16, align: "center" });
    }

    let y = input.status === "REVERSED" ? 174 : 136;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333").text("MACMIILKA", left, y);
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#111111").text(input.customer.name, left, y + 17, { width: 250, ellipsis: true });
    if (input.customer.phone) doc.font("Helvetica").fontSize(8).fillColor("#333333").text(input.customer.phone, left, y + 39);
    doc.moveTo(302, y - 2).lineTo(302, y + 59).strokeColor("#bbbbbb").lineWidth(0.45).stroke();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#333333").text("FAAHFAAHINTA LACAGTA", 320, y);
    const accountLabel = input.account ? `${input.account.name}${input.account.identifierMasked ? ` (${input.account.identifierMasked})` : ""}` : "Akoon lama cayimin — wuxuu u baahan yahay in la waafajiyo";
    const details = [["Habka", somaliLabel(input.method)], ["Akoon", accountLabel], ["Tixraac", input.reference ?? "-"]];
    details.forEach(([label, value], index) => {
      doc.font("Helvetica").fontSize(7.5).fillColor("#555555").text(`${label}:`, 320, y + 17 + index * 14, { width: 57 });
      doc.font("Helvetica").fontSize(7.5).fillColor("#111111").text(value!, 380, y + 17 + index * 14, { width: 173, ellipsis: true });
    });
    y += 83;

    doc.rect(left, y, width, 62).fill("#f3f3f3");
    doc.font("Helvetica").fontSize(8.5).fillColor("#444444").text("LACAGTA LA BIXIYEY", left + 14, y + 13);
    doc.font("Helvetica-Bold").fontSize(25).fillColor("#111111").text(`$${input.amount}`, left + 14, y + 29, { width: width - 28 });
    y += 83;

    if (input.order) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text(`LACAG-BIXINTA DALABKA - ${input.order.orderNo}`, left, y);
      y += 20;
      const rows: Array<[string, string]> = [["Wadarta Dalabka", input.order.total], ["Hadda La Bixiyey", input.order.paidThisTime], ["Haraaga La Filayo", input.order.remainingPendingDelivery]];
      rows.forEach(([label, value], index) => {
        const rowY = y + index * 27;
        doc.rect(left, rowY, width, 27).strokeColor("#d4d4d4").lineWidth(0.4).stroke();
        doc.font(index === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor("#222222").text(label, left + 9, rowY + 9, { width: 330 });
        doc.font(index === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(`$${value}`, right - 135, rowY + 9, { width: 126, align: "right" });
      });
      y += rows.length * 27 + 22;
    } else if (input.deliveredOrders.length) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text("DALABYADA LA GEYEY EE LA BIXIYEY", left, y);
      y += 20;
      input.deliveredOrders.forEach((row, index) => {
        const rowY = y + index * 27;
        doc.rect(left, rowY, width, 27).strokeColor("#d4d4d4").lineWidth(0.4).stroke();
        doc.font("Helvetica").fontSize(8).fillColor("#111111").text(row.invoiceNo, left + 8, rowY + 9, { width: 190 });
        doc.text(`La Bixiyey $${row.paid}`, left + 210, rowY + 9, { width: 125 });
        doc.text(`Haraaga $${row.remaining}`, right - 150, rowY + 9, { width: 142, align: "right" });
      });
      y += input.deliveredOrders.length * 27 + 22;
    }

    const signY = Math.max(y + 14, 510);
    doc.moveTo(left, signY).lineTo(left + 205, signY).strokeColor("#888888").lineWidth(0.45).stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor("#444444").text(`Qofka Lacagta Qabtay: ${input.collectedBy}`, left, signY + 8, { width: 205 });
    doc.moveTo(right - 205, signY).lineTo(right, signY).strokeColor("#888888").lineWidth(0.45).stroke();
    doc.text("Saxiixa Macmiilka", right - 205, signY + 8, { width: 205, align: "center" });
    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor("#444444").text("Waad ku mahadsan tahay. Rasiidhkan u xafid diiwaankaaga.", left, signY + 48, { width, align: "center" });

    addDocumentFooter(doc, input.branding);
    doc.end();
  });
}
