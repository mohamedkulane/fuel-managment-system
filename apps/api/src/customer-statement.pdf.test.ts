import { describe, expect, it } from "vitest";
import { compactPaymentReference, createCustomerStatementPdf } from "./customer-statement.pdf.js";

const baseInput = {
  customer: { name: "Customer Example", phone: "+252 61 2345678", location: "Mogadishu" },
  period: "01 Oct 2026 – 13 Oct 2026",
  generatedAt: "13 Oct 2026, 16:05",
  openingDebt: "0.00",
  totalSales: "240.00",
  totalPaid: "170.00",
  remainingDebt: "70.00",
  pendingOrderRemaining: "0.00",
  moneyToReview: "0.00",
  closingDebt: "70.00",
  branding: { companyName: "FuelDesk", logoUrl: null, footerText: "Kheyre Petroleum", logo: null },
  orders: [{
    date: "13 Oct 2026",
    orderNo: "ORD-001",
    fuel: "Naafto",
    acceptedSale: "240.00",
    paid: "170.00",
    remaining: "70.00",
    remainingLabel: "Debt" as const,
    payments: [{ date: "13 Oct 2026", reference: "PAY-8A66F88E", amount: "170.00", status: "Paid" }]
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
    const orders = Array.from({ length: 30 }, (_, index) => ({
      ...baseInput.orders[0]!,
      orderNo: `ORD-${String(index + 1).padStart(3, "0")}`
    }));
    const pdf = await createCustomerStatementPdf({ ...baseInput, orders });
    const pageCount = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

    expect(pageCount).toBeGreaterThan(1);
  });
});
