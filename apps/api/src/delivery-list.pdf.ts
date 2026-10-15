import PDFDocument from "pdfkit";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";
import type { DeliveryListData } from "./delivery-list.js";

const PAGE_WIDTH = 595.28;
const PAGE_BOTTOM = 760;
const TABLE_X = 34;
const TABLE_WIDTH = 527;
const COLUMN_WIDTHS = [132, 89, 158, 78, 70] as const;
const COLUMN_HEADERS = ["Macmiil", "Telefoon", "Goobta", "Shidaalka", "Fuusto"] as const;

export async function createDeliveryListPdf(
  list: DeliveryListData,
  branding: ResolvedDocumentBranding,
  generatedAt = new Date()
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 30, right: 34, bottom: 30, left: 34 },
    bufferPages: true,
    info: { Title: "Liiska Gaarsiinta", Author: branding.companyName }
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const renderPageHeader = () => {
      drawDocumentLogo(doc, branding, 34, 30, 45, 38);
      doc.font("Helvetica-Bold").fontSize(17).fillColor("#000000")
        .text("LIISKA GAARSIINTA", 300, 36, { width: PAGE_WIDTH - 334, align: "right", lineBreak: false });
      doc.font("Helvetica").fontSize(9).fillColor("#222222")
        .text(`Taariikh: ${list.date}`, 300, 60, { width: PAGE_WIDTH - 334, align: "right", lineBreak: false });
      doc.text(`La diyaariyey: ${generatedAt.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}`, 300, 74, {
        width: PAGE_WIDTH - 334,
        align: "right",
        lineBreak: false
      });
      doc.moveTo(TABLE_X, 101).lineTo(TABLE_X + TABLE_WIDTH, 101).lineWidth(0.7).strokeColor("#111111").stroke();
    };

    const renderTableHeader = () => {
      const headerTop = doc.y;
      let x = TABLE_X;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
      doc.moveTo(TABLE_X, headerTop).lineTo(TABLE_X + TABLE_WIDTH, headerTop).lineWidth(0.35).strokeColor("#555555").stroke();
      COLUMN_HEADERS.forEach((header, index) => {
        doc.text(header, x + 4, headerTop + 8, { width: COLUMN_WIDTHS[index]! - 8, lineBreak: false });
        x += COLUMN_WIDTHS[index]!;
      });
      doc.y = headerTop + 27;
      doc.moveTo(TABLE_X, doc.y).lineTo(TABLE_X + TABLE_WIDTH, doc.y).lineWidth(0.45).strokeColor("#333333").stroke();
      doc.y += 2;
      doc.font("Helvetica").fontSize(9).fillColor("#111111");
    };

    renderPageHeader();
    doc.y = 116;
    renderTableHeader();

    for (const row of list.rows) {
      const values = [row.customer, row.phone, row.location, row.fuel, row.quantity];
      const rowHeight = Math.max(
        28,
        ...values.map((value, index) => doc.heightOfString(value, { width: COLUMN_WIDTHS[index]! - 8, lineGap: 2 }) + 12)
      );
      if (doc.y + rowHeight > PAGE_BOTTOM) {
        doc.addPage();
        renderPageHeader();
        doc.y = 116;
        renderTableHeader();
      }

      const rowTop = doc.y;
      let x = TABLE_X;
      values.forEach((value, index) => {
        doc.text(value, x + 4, rowTop + 7, { width: COLUMN_WIDTHS[index]! - 8, lineGap: 2 });
        x += COLUMN_WIDTHS[index]!;
      });
      doc.y = rowTop + rowHeight;
      doc.moveTo(TABLE_X, doc.y).lineTo(TABLE_X + TABLE_WIDTH, doc.y).lineWidth(0.25).strokeColor("#888888").stroke();
      doc.y += 2;
    }

    addDocumentFooter(doc, branding);
    doc.end();
  });
}
