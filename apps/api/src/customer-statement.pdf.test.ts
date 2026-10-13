import { describe, expect, it } from "vitest";
import { compactPaymentReference, createCustomerStatementPdf } from "./customer-statement.pdf.js";

const baseInput = {
  customer: { name: "Customer Example", phone: "+252 61 2345678", location: "Mogadishu" },
  period: "01 Oct 2026 – 13 Oct 2026",
  generatedAt: "13 Oct 2026, 16:05",
  openingBalanceLabel: "Opening Debt",
  openingBalance: "0.00",
  totalSales: "240.00",
  totalPayments: "170.00",
  currentBalance: "70.00",
  currentBalanceLabel: "Debt",
  branding: { companyName: "FuelDesk", logoUrl: null, footerText: "Kheyre Petroleum", logo: null },
  rows: [{
    date: "13 Oct 2026",
    time: "16:05",
    type: "Sale",
    reference: "SAL-001",
    description: "Fuel Sale (Naafto)\n10 Fuusto × $24.00",
    amount: "240.00",
    balance: "Debt $240.00"
  }]
};

describe("customer statement PDF", () => {
  it("shortens generated payment references without changing unrelated references", () => {
    expect(compactPaymentReference("PAY-1791896713347-8a66f88e")).toBe("PAY-8A66F88E");
    expect(compactPaymentReference("SAL-1791896713347-8a66f88e")).toBe("SAL-1791896713347-8a66f88e");
  });

  it("generates a readable PDF document for a statement", async () => {
    const pdf = await createCustomerStatementPdf(baseInput);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
  });

  it("continues long statements onto additional pages", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      ...baseInput.rows[0]!,
      reference: `SAL-${String(index + 1).padStart(3, "0")}`
    }));
    const pdf = await createCustomerStatementPdf({ ...baseInput, rows });
    const pageCount = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

    expect(pageCount).toBeGreaterThan(1);
  });
});
