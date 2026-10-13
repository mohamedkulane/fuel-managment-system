import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { Prisma } from "@fuel/database";
import { buildDeliveryList, deliveryListDateBounds, deliveryListOrderWhere } from "./delivery-list.js";
import { createDeliveryListPdf } from "./delivery-list.pdf.js";

const emptyBranding = {
  companyName: "FuelDesk",
  logoUrl: null,
  footerText: null,
  logo: null
};

describe("historical delivery lists", () => {
  it.each([
    ["2026-10-13", "2026-10-12T21:00:00.000Z", "2026-10-13T21:00:00.000Z"],
    ["2026-10-12", "2026-10-11T21:00:00.000Z", "2026-10-12T21:00:00.000Z"],
    ["2026-10-06", "2026-10-05T21:00:00.000Z", "2026-10-06T21:00:00.000Z"]
  ])("uses the Mogadishu business day for %s", (date, expectedStart, expectedEnd) => {
    const bounds = deliveryListDateBounds(date);

    expect(bounds.orderDateStart.toISOString()).toBe(expectedStart);
    expect(bounds.orderDateEnd.toISOString()).toBe(expectedEnd);
    expect(bounds.requestedDateStart.toISOString()).toBe(`${date}T00:00:00.000Z`);
  });

  it.each(["", "2026-02-30", "2026/10/13", "13-10-2026"])("rejects invalid selected dates: %s", (date) => {
    expect(() => deliveryListDateBounds(date)).toThrow();
  });

  it("filters by the selected requested date, includes completed statuses, and uses Mogadishu order-date fallback", () => {
    const where = deliveryListOrderWhere(deliveryListDateBounds("2026-10-13"));

    expect(where.status).toEqual({ notIn: ["DRAFT", "CANCELLED"] });
    expect(where.OR).toEqual([
      {
        requestedDeliveryDate: {
          gte: new Date("2026-10-13T00:00:00.000Z"),
          lt: new Date("2026-10-14T00:00:00.000Z")
        }
      },
      {
        requestedDeliveryDate: null,
        orderDate: {
          gte: new Date("2026-10-12T21:00:00.000Z"),
          lt: new Date("2026-10-13T21:00:00.000Z")
        }
      }
    ]);
  });

  it("prefers persisted sheet snapshots and retains the full planned quantity after partial delivery", () => {
    const list = buildDeliveryList("2026-10-13", [{
      orderLineId: "line-1",
      scheduledUnits: new Prisma.Decimal("6"),
      displayCustomerNameSnapshot: "Historical Customer",
      phoneSnapshot: "+252611111111",
      addressSnapshot: "Snapshot Location",
      orderLine: { fuel: { code: "DIESEL" } }
    }], [{
      id: "order-1",
      requestedDeliveryDate: new Date("2026-10-13T00:00:00.000Z"),
      orderDate: new Date("2026-10-12T23:00:00.000Z"),
      addressSnapshot: "Changed Order Location",
      customer: { name: "Current Customer", primaryPhone: "+252622222222" },
      lines: [
        { id: "line-1", requestedUnits: new Prisma.Decimal("6"), fuel: { code: "DIESEL" } },
        { id: "line-2", requestedUnits: new Prisma.Decimal("4"), fuel: { code: "PETROL" } }
      ]
    }]);

    expect(list.rows).toEqual([
      { customer: "Current Customer", phone: "+252622222222", location: "Changed Order Location", fuel: "Basiin", quantity: "4" },
      { customer: "Historical Customer", phone: "+252611111111", location: "Snapshot Location", fuel: "Naafto", quantity: "6" }
    ]);
  });

  it("returns an empty dated list without extra financial or total fields", () => {
    expect(buildDeliveryList("2026-10-06", [], [])).toEqual({
      date: "2026-10-06",
      rows: []
    });
  });

  it("keeps the planned quantity for partially fulfilled orders", () => {
    const partiallyDeliveredOrder = {
      id: "order-partial",
      status: "PARTIALLY_FULFILLED",
      requestedDeliveryDate: new Date("2026-10-13T00:00:00.000Z"),
      orderDate: new Date("2026-10-12T23:00:00.000Z"),
      addressSnapshot: "Hodan",
      customer: { name: "Partial Customer", primaryPhone: "+252611111111" },
      lines: [{
        id: "line-partial",
        requestedUnits: new Prisma.Decimal("8"),
        fuel: { code: "PETROL" },
        dispatchLines: [{ confirmations: [{ acceptedUnits: new Prisma.Decimal("5") }] }]
      }]
    };

    const list = buildDeliveryList("2026-10-13", [], [partiallyDeliveredOrder]);

    expect(list.rows).toEqual([{
      customer: "Partial Customer",
      phone: "+252611111111",
      location: "Hodan",
      fuel: "Basiin",
      quantity: "8"
    }]);
  });

  it("creates a printable A4 PDF for empty or populated lists", async () => {
    const list = buildDeliveryList("2026-10-13", [], [{
      id: "order-1",
      requestedDeliveryDate: new Date("2026-10-13T00:00:00.000Z"),
      orderDate: new Date("2026-10-12T23:00:00.000Z"),
      addressSnapshot: "Wadajir, Mogadishu",
      customer: { name: "Customer One", primaryPhone: "+252611111111" },
      lines: [{ id: "line-1", requestedUnits: new Prisma.Decimal("6"), fuel: { code: "DIESEL" } }]
    }]);
    const pdf = await createDeliveryListPdf(list, emptyBranding, new Date("2026-10-13T10:00:00.000Z"));
    const bytes = pdf.toString("latin1");
    const textStreams = [...bytes.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
      .map((match) => inflateSync(Buffer.from(match[1]!, "latin1")).toString("latin1"))
      .join("\n");
    const decodedText = textStreams.replace(/<([0-9a-f]{2,})>/gi, (_match, hex: string) => Buffer.from(hex, "hex").toString("latin1"));

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes).toContain("%%EOF");
    expect(decodedText).toContain("Customer One");
    expect(decodedText).toContain("Naafto");
    expect(decodedText).not.toMatch(/Wadarta|Total Fuusto/i);
    expect(decodedText).not.toMatch(/price|discount|debt|payment|purchase cost|balance/i);
    expect((bytes.match(/\/Type \/Page\b/g) ?? []).length).toBe(1);

    const emptyPdf = await createDeliveryListPdf(buildDeliveryList("2026-10-06", [], []), emptyBranding);
    expect(emptyPdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
