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
  const margin = 30;
  const doc = new PDFDocument({
    margin,
    size: "A4",
    layout: options.columns.length >= 6 ? "landscape" : "portrait",
    autoFirstPage: true,
    bufferPages: true
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (options.branding) drawDocumentLogo(doc, options.branding);
    const pageWidth = doc.page.width - margin * 2;
    const tableX = margin;
    const tableWidth = pageWidth;
    const tableBottom = doc.page.height - (options.branding ? 54 : margin);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a")
      .text(options.title.toUpperCase(), margin, 84, { width: pageWidth, align: "right" });
    if (options.subtitle) {
      doc.font("Helvetica").fontSize(9).fillColor("#666666")
        .text(options.subtitle, margin, doc.y + 3, { width: pageWidth, align: "right" });
    }
    doc.font("Helvetica").fontSize(8).fillColor("#999999")
      .text(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, margin, doc.y + 3, {
        width: pageWidth,
        align: "right"
      });

    let currentY = doc.y + 12;
    if (options.filters && Object.keys(options.filters).length > 0) {
      const filters = "Applied Filters: " + Object.entries(options.filters).map(([key, value]) => `${key}: ${value}`).join(" | ");
      doc.font("Helvetica").fontSize(8).fillColor("#475569")
        .text(filters, tableX, currentY, { width: tableWidth });
      currentY = doc.y + 8;
    }

    const widthWeight = (column: ColumnDef) => Math.max(1, column.width ?? column.header.length + 4);
    const totalWeight = options.columns.reduce((total, column) => total + widthWeight(column), 0);
    const columnWidths = options.columns.map((column) => tableWidth * widthWeight(column) / totalWeight);
    const columnX = columnWidths.map((_, index) =>
      tableX + columnWidths.slice(0, index).reduce((sum, width) => sum + width, 0)
    );
    const cellWidth = (index: number) => Math.max(1, columnWidths[index]! - 10);
    const cellText = (column: ColumnDef, value: unknown): string => {
      if (value === null || value === undefined) return "—";
      if (column.format === "currency") return `$${parseFloat(String(value)).toFixed(2)}`;
      if (column.format === "decimal") return parseFloat(String(value)).toFixed(3);
      return String(value);
    };
    const measuredHeight = (
      values: string[],
      fontSize: number,
      minimum: number,
      padding: number,
      font: "Helvetica" | "Helvetica-Bold" = "Helvetica"
    ) => {
      doc.font(font).fontSize(fontSize);
      return Math.max(
        minimum,
        ...values.map((value, index) =>
          doc.heightOfString(value, { width: cellWidth(index), lineGap: 1 }) + padding
        )
      );
    };
    const headerHeight = measuredHeight(options.columns.map((column) => column.header), 8, 24, 10, "Helvetica-Bold");
    const drawTableHeader = () => {
      doc.rect(tableX, currentY, tableWidth, headerHeight).fill("#1e293b");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
      options.columns.forEach((column, index) => {
        doc.text(column.header, columnX[index]! + 5, currentY + 5, {
          width: cellWidth(index),
          height: headerHeight - 10,
          lineGap: 1,
          align: column.align || "left"
        });
      });
      currentY += headerHeight;
      doc.moveTo(tableX, currentY).lineTo(tableX + tableWidth, currentY)
        .lineWidth(0.45).strokeColor("#cbd5e1").stroke();
      doc.font("Helvetica").fontSize(8).fillColor("#0f172a");
    };
    const startNewPage = () => {
      doc.addPage();
      currentY = margin;
      drawTableHeader();
    };

    drawTableHeader();
    options.rows.forEach((row, rowIndex) => {
      const values = options.columns.map((column) => cellText(column, row[column.key]));
      const height = measuredHeight(values, 8, 20, 10);
      if (currentY + height > tableBottom) startNewPage();

      doc.rect(tableX, currentY, tableWidth, height).fill(rowIndex % 2 === 0 ? "#f8fafc" : "#ffffff");
      doc.fillColor("#0f172a").font("Helvetica").fontSize(8);
      options.columns.forEach((column, index) => {
        doc.text(values[index]!, columnX[index]! + 5, currentY + 5, {
          width: cellWidth(index),
          height: height - 10,
          lineGap: 1,
          align: column.align || "left"
        });
      });
      currentY += height;
    });

    if (options.totals) {
      const values = options.columns.map((column, index) => {
        if (index === 0) return "TOTALS";
        const value = options.totals![column.key];
        return value === null || value === undefined || value === "" ? "" : cellText(column, value);
      });
      const height = measuredHeight(values, 8, 22, 10);
      if (currentY + height > tableBottom) startNewPage();
      doc.rect(tableX, currentY, tableWidth, height).fill("#0f172a");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
      options.columns.forEach((column, index) => {
        doc.text(values[index]!, columnX[index]! + 5, currentY + 5, {
          width: cellWidth(index),
          height: height - 10,
          lineGap: 1,
          align: column.align || "left"
        });
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
