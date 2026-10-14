import { describe, expect, it } from "vitest";
import { exportToPdf } from "./reports.exporter.js";

describe("report PDF export", () => {
  it("uses landscape pages and wraps wide report cells without overlapping fixed-height rows", async () => {
    const columns = Array.from({ length: 7 }, (_, index) => ({
      header: `Column ${index + 1} with a longer label`,
      key: `column${index + 1}`,
      width: index === 1 ? 28 : 12
    }));
    const pdf = await exportToPdf({
      title: "Customer List and Financial Position",
      columns,
      rows: [{
        column1: "CUS-0001",
        column2: "A customer name that is long enough to wrap cleanly across multiple lines",
        column3: "+252 61 1234567",
        column4: "ACTIVE",
        column5: "1200.00",
        column6: "800.00",
        column7: "400.00"
      }],
      branding: { companyName: "FuelDesk", logoUrl: null, footerText: "FuelDesk", logo: null }
    });
    const pdfSource = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfSource).toMatch(/\/MediaBox \[0 0 841\.89 595\.28\]/);
  });

  it("repeats the table header when report rows continue on another page", async () => {
    const pdf = await exportToPdf({
      title: "Sales Report",
      columns: [{ header: "Order", key: "order", width: 12 }, { header: "Customer", key: "customer", width: 24 }],
      rows: Array.from({ length: 70 }, (_, index) => ({
        order: `ORD-${String(index + 1).padStart(4, "0")}`,
        customer: `Customer ${index + 1}`
      }))
    });
    const pageCount = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

    expect(pageCount).toBeGreaterThan(1);
  });
});
