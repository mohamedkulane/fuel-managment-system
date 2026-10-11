import { describe, expect, it } from "vitest";
import { Prisma } from "@fuel/database";
import { deliveryManifestLineSchema } from "@fuel/shared";

describe("Phase 1–2 domain invariants", () => {
  it("keeps fuusto conversion and accepted delivery arithmetic decimal-safe", () => {
    const litersPerFuusto = new Prisma.Decimal("240");
    const dispatched = new Prisma.Decimal("20").mul(litersPerFuusto);
    const accepted = new Prisma.Decimal("18").mul(litersPerFuusto);
    const returned = new Prisma.Decimal("2").mul(litersPerFuusto);
    expect(dispatched.toFixed(3)).toBe("4800.000");
    expect(accepted.add(returned).toFixed(3)).toBe(dispatched.toFixed(3));
    expect(accepted.toFixed(3)).toBe("4320.000");
  });

  it("allowlists the delivery manifest and excludes financial fields", () => {
    const line = deliveryManifestLineSchema.parse({ orderNo: "SO-1", customerName: "Ahmed", phone: null, address: "Hodan", fuel: "DIESEL", scheduledUnits: "20.000", instructions: null });
    const serialized = JSON.stringify(line);
    expect(serialized).not.toMatch(/price|cost|debt|payment|revenue|profit|tax/i);
  });

  it("rejects non-decimal manifest quantities", () => {
    expect(() => deliveryManifestLineSchema.parse({ orderNo: "SO-1", customerName: "Ahmed", phone: null, address: "Hodan", fuel: "DIESEL", scheduledUnits: 20, instructions: null })).toThrow();
  });
});
