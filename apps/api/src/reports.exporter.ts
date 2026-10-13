import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { addDocumentFooter, drawDocumentLogo, type ResolvedDocumentBranding } from "./document-branding.js";

export type ColumnDef = {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: "string" | "currency" | "decimal" | "date" | "badge";
};

export async function exportToPdf(options: {
  title: string;
  subtitle?: string;
  filters?: Record<string, string>;
  columns: ColumnDef[];
  rows: Record<string, any>[];
  totals?: Record<string, any>;
  branding?: ResolvedDocumentBranding;
}): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 30, size: "A4", autoFirstPage: true, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (options.branding) drawDocumentLogo(doc, options.branding);
    doc.fontSize(16).text(options.title.toUpperCase(), { align: "right" });
    if (options.subtitle) doc.fontSize(9).fillColor("#666666").text(options.subtitle, { align: "right" });
    doc.fontSize(8).fillColor("#999999").text(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, { align: "right" });
    doc.fillColor("#000000").moveDown(1);

    if (options.filters && Object.keys(options.filters).length > 0) {
      doc.fontSize(9).text("Applied Filters: " + Object.entries(options.filters).map(([k, v]) => `${k}: ${v}`).join(" | "));
      doc.moveDown(0.5);
    }

    // Table Setup
    const startX = 30;
    let currentY = doc.y;
    const pageWidth = 535; // A4 width minus margins
    const numCols = options.columns.length;
    const colWidth = Math.floor(pageWidth / numCols);

    // Draw Table Header
    doc.rect(startX, currentY, pageWidth, 20).fill("#1e293b");
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");

    options.columns.forEach((col, idx) => {
      const x = startX + idx * colWidth + 4;
      doc.text(col.header, x, currentY + 5, { width: colWidth - 8, align: col.align || "left" });
    });

    currentY += 20;
    doc.fillColor("#000000").font("Helvetica").fontSize(8);

    // Draw Rows
    options.rows.forEach((row, rowIdx) => {
      // Page break check
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
        // Re-draw Table Header on new page
        doc.rect(startX, currentY, pageWidth, 20).fill("#1e293b");
        doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
        options.columns.forEach((col, idx) => {
          const x = startX + idx * colWidth + 4;
          doc.text(col.header, x, currentY + 5, { width: colWidth - 8, align: col.align || "left" });
        });
        currentY += 20;
        doc.fillColor("#000000").font("Helvetica").fontSize(8);
      }

      const bg = rowIdx % 2 === 0 ? "#f8fafc" : "#ffffff";
      doc.rect(startX, currentY, pageWidth, 18).fill(bg);
      doc.fillColor("#0f172a");

      options.columns.forEach((col, idx) => {
        const x = startX + idx * colWidth + 4;
        let val = row[col.key] ?? "—";
        if (col.format === "currency" && val !== "—") val = `$${parseFloat(val).toFixed(2)}`;
        else if (col.format === "decimal" && val !== "—") val = parseFloat(val).toFixed(3);
        doc.text(String(val), x, currentY + 4, { width: colWidth - 8, align: col.align || "left" });
      });

      currentY += 18;
    });

    // Draw Totals if provided
    if (options.totals) {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
      }
      doc.rect(startX, currentY, pageWidth, 20).fill("#0f172a");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);

      options.columns.forEach((col, idx) => {
        const x = startX + idx * colWidth + 4;
        let val = idx === 0 ? "TOTALS" : options.totals![col.key] ?? "";
        if (col.format === "currency" && val !== "" && val !== "TOTALS") val = `$${parseFloat(val).toFixed(2)}`;
        else if (col.format === "decimal" && val !== "" && val !== "TOTALS") val = parseFloat(val).toFixed(3);
        doc.text(String(val), x, currentY + 5, { width: colWidth - 8, align: col.align || "left" });
      });
    }

    if (options.branding) addDocumentFooter(doc, options.branding);
    doc.end();
  });
}

export async function exportToExcel(options: {
  title: string;
  filters?: Record<string, string>;
  columns: ColumnDef[];
  rows: Record<string, any>[];
  totals?: Record<string, any>;
  branding?: ResolvedDocumentBranding;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fuel Wholesale Management System";
  workbook.created = new Date();

  const hasLogo = Boolean(options.branding?.logo);
  const titleRow = hasLogo ? 3 : 1;
  const worksheet = workbook.addWorksheet("Report", { views: [{ state: "frozen", ySplit: titleRow + (options.filters ? 3 : 1) }] });

  // Title block
  worksheet.mergeCells(titleRow, 1, titleRow, options.columns.length);
  const titleCell = worksheet.getCell(titleRow, 1);
  titleCell.value = `${options.title.toUpperCase()} (Generated: ${new Date().toISOString().slice(0, 10)})`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  if (options.branding?.logo) {
    const extension = options.branding.logo[0] === 0x89 ? "png" : "jpeg";
    const imageId = workbook.addImage({ base64: options.branding.logo.toString("base64"), extension });
    worksheet.addImage(imageId, "A1:B3");
  }

  let startRow = titleRow + 1;
  if (options.filters && Object.keys(options.filters).length > 0) {
    const filterText = Object.entries(options.filters).map(([k, v]) => `${k}: ${v}`).join(" | ");
    const filterRow = titleRow + 1;
    worksheet.mergeCells(filterRow, 1, filterRow, options.columns.length);
    const filterCell = worksheet.getCell(filterRow, 1);
    filterCell.value = `Filters: ${filterText}`;
    filterCell.font = { name: "Arial", size: 10, italic: true };
    startRow = titleRow + 2;
  }

  // Header Row
  const headerRow = worksheet.getRow(startRow);
  options.columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
  });
  headerRow.height = 24;

  // Data Rows
  options.rows.forEach((row) => {
    const dataRow = worksheet.addRow(
      options.columns.map((col) => {
        let val = row[col.key] ?? "";
        if (col.format === "currency" && val !== "") return parseFloat(val);
        if (col.format === "decimal" && val !== "") return parseFloat(val);
        return val;
      })
    );

    options.columns.forEach((col, idx) => {
      const cell = dataRow.getCell(idx + 1);
      cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
      if (col.format === "currency") cell.numFmt = "$#,##0.00";
      else if (col.format === "decimal") cell.numFmt = "#,##0.000";
    });
  });

  // Totals Row
  if (options.totals) {
    const totalsRowValues = options.columns.map((col, idx) => {
      if (idx === 0) return "TOTALS";
      let val = options.totals![col.key] ?? "";
      if ((col.format === "currency" || col.format === "decimal") && val !== "") return parseFloat(val);
      return val;
    });

    const totalsRow = worksheet.addRow(totalsRowValues);
    totalsRow.font = { bold: true };
    options.columns.forEach((col, idx) => {
      const cell = totalsRow.getCell(idx + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      cell.alignment = { vertical: "middle", horizontal: col.align || "left" };
      if (col.format === "currency") cell.numFmt = "$#,##0.00";
      else if (col.format === "decimal") cell.numFmt = "#,##0.000";
    });
  }

  if (options.branding) {
    const footerRow = worksheet.lastRow!.number + 2;
    worksheet.mergeCells(footerRow, 1, footerRow, options.columns.length);
    const footerCell = worksheet.getCell(footerRow, 1);
    footerCell.value = options.branding.footerText ?? "Fuel Wholesale Management System";
    footerCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF5D6B64" } };
    footerCell.alignment = { horizontal: "center" };
  }

  // Column Widths
  options.columns.forEach((col, idx) => {
    const column = worksheet.getColumn(idx + 1);
    column.width = col.width ?? Math.max(15, col.header.length + 5);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
