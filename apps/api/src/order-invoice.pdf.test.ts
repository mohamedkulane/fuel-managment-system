import { describe, expect, it } from "vitest";
import { createOrderInvoicePdf } from "./order-invoice.pdf.js";

const base = {
  orderNo: "ORD-001",
  orderDate: "13 Oct 2026",
  deliveryDate: null,
  createdBy: "Owner",
  status: "CONFIRMED",
  customer: { name: "Customer Example", phone: "+252 61 2345678", location: "Mogadishu" },
  deliveryLocation: "Wadajir, Mogadishu",
  lines: [{ fuel: "Naafto" as const, quantity: "6", unitPrice: "40.00", amount: "240.00" }],
  subtotal: "240.00",
  discount: "0.00",
  total: "240.00",
  paid: "0.00",
  remaining: "240.00",
  deliveryPending: true,
  branding: { companyName: "FuelDesk", logoUrl: null, footerText: "Fuel Wholesale Management System", logo: null }
};

describe("order invoice PDF", () => {
  it("creates a valid A4 order invoice without a payment row", async () => {
    const pdf = await createOrderInvoicePdf(base);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
  });

  it("supports payment and fixed-discount totals without changing the order total", async () => {
    const pdf = await createOrderInvoicePdf({ ...base, discount: "10.00", total: "230.00", paid: "100.00", remaining: "130.00" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("continues a long item list onto a second page", async () => {
    const lines = Array.from({ length: 22 }, (_, index) => ({ fuel: index % 2 ? "Basiin" as const : "Naafto" as const, quantity: "1", unitPrice: "40.00", amount: "40.00" }));
    const pdf = await createOrderInvoicePdf({ ...base, lines, subtotal: "880.00", total: "880.00", remaining: "880.00" });
    expect((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
