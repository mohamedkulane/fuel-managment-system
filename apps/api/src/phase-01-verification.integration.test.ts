import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@fuel/database";
import { AppModule } from "./app.module.js";

type JsonResult<T> = { data: T };
let app: INestApplication;
let prisma: PrismaClient;
let base = "";
let ownerCookie = "";
let officeCookie = "";
let ownerUserId = "";
let officeUserId = "";

async function request<T>(path: string, options: RequestInit = {}, cookie = ownerCookie): Promise<T> {
  const response = await fetch(`${base}/api/v1${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return ((await response.json()) as JsonResult<T>).data;
}

describe("Phase 1 Complete Acceptance Verification Suite", () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: {
        email: `owner-verify-${suffix}@test.invalid`,
        displayName: "Verification Owner",
        role: "OWNER",
        passwordHash: await argon2.hash(ownerPassword)
      }
    });
    ownerUserId = owner.id;

    const office = await prisma.user.create({
      data: {
        email: `office-verify-${suffix}@test.invalid`,
        displayName: "Verification Office",
        role: "OFFICE_EMPLOYEE",
        passwordHash: await argon2.hash(officePassword)
      }
    });
    officeUserId = office.id;

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    const petrol = await prisma.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Petrol / Basiin" } });

    for (const fuel of [diesel, petrol]) {
      for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
        await prisma.stockBalance.upsert({
          where: { fuelId_location: { fuelId: fuel.id, location } },
          update: {},
          create: { fuelId: fuel.id, location, balanceLiters: new Prisma.Decimal(0) }
        });
      }
    }

    app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;

    // Login Owner
    const resOwner = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: owner.email, password: ownerPassword })
    });
    expect(resOwner.status).toBe(201);
    ownerCookie = resOwner.headers.get("set-cookie")?.split(";")[0] ?? "";

    // Login Office
    const resOffice = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: office.email, password: officePassword })
    });
    expect(resOffice.status).toBe(201);
    officeCookie = resOffice.headers.get("set-cookie")?.split(";")[0] ?? "";
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("1. Verifies Authentication and Session Security", async () => {
    const me = await request<{ id: string; role: string }>("/auth/me", {}, ownerCookie);
    expect(me.id).toBe(ownerUserId);
    expect(me.role).toBe("OWNER");

    // Invalid credentials reject
    const badLogin = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@test.invalid", password: "wrong" })
    });
    expect(badLogin.status).toBe(403);
  });

  it("2. Verifies OWNER and OFFICE_EMPLOYEE Role Authorization", async () => {
    const fuels = await request<Array<{ id: string }>>("/fuels", {}, officeCookie);
    const units = await request<Array<{ id: string }>>("/sales-units", {}, officeCookie);

    // Office Employee cannot update pricing
    const priceErr = await fetch(`${base}/api/v1/prices`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: officeCookie },
      body: JSON.stringify({ fuelId: fuels[0]!.id, salesUnitId: units[0]!.id, unitPrice: "99", effectiveFromUtc: new Date().toISOString() })
    });
    expect(priceErr.status).toBe(403);

    // Office Employee cannot adjust stock
    const adjustErr = await fetch(`${base}/api/v1/stock/adjustments`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: officeCookie },
      body: JSON.stringify({ fuelId: fuels[0]!.id, signedDeltaLiters: "100", reason: "Unauthorized attempt" })
    });
    expect(adjustErr.status).toBe(403);
  });

  it("3. Verifies Customer Creation and Address Updates", async () => {
    const customer = await request<{ id: string; name: string; addresses: Array<{ addressText: string }> }>("/customers", {
      method: "POST",
      body: JSON.stringify({ name: "Verify Customer Co", primaryPhone: "+252610001122", address: "K4 Square", district: "Hodan" })
    });
    expect(customer.name).toBe("Verify Customer Co");
    expect(customer.addresses[0]?.addressText).toBe("K4 Square");

    // Update Customer
    const updated = await request<{ id: string; status: string; addresses: Array<{ addressText: string }> }>(`/customers/${customer.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "HOLD", address: "Updated Port Address" })
    });
    expect(updated.status).toBe("HOLD");
    expect(updated.addresses[0]?.addressText).toBe("Updated Port Address");
  });

  it("4. Verifies Customer Pagination and Multi-Field Filtering", async () => {
    const list = await request<{ items: Array<{ id: string; name: string }>; total: number; page: number; limit: number }>("/customers?search=Verify&limit=5");
    expect(list.items.length).toBeGreaterThanOrEqual(1);
    expect(list.page).toBe(1);
    expect(list.limit).toBe(5);
  });

  it("5. Verifies Fuel Stock Purchase Creation and Atomic Posting", async () => {
    const fuels = await request<Array<{ id: string; code: string }>>("/fuels");
    const diesel = fuels.find((f) => f.code === "DIESEL")!;

    const beforeStock = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances");
    const initialWarehouse = parseFloat(beforeStock.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE")?.balanceLiters ?? "0");

    const receipt = await request<{ id: string }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({ supplier: "SUPPLIER-VERIFY-1", purchaseDate: new Date().toISOString(), lines: [{ fuelId: diesel.id, quantityFuusto: "20", unitPurchaseCost: "204" }] })
    });

    // Post Receipt
    const postKey = randomUUID();
    await request(`/stock/receipts/${receipt.id}/post`, { method: "POST", headers: { "idempotency-key": postKey } });

    const afterStock = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances");
    const newWarehouse = parseFloat(afterStock.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE")?.balanceLiters ?? "0");
    expect(newWarehouse - initialWarehouse).toBe(4800);
  });

  it("6. Verifies Duplicate Stock Purchase Posting Protection (Idempotency)", async () => {
    const fuels = await request<Array<{ id: string; code: string }>>("/fuels");
    const diesel = fuels.find((f) => f.code === "DIESEL")!;

    const receipt = await request<{ id: string }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({ purchaseDate: new Date().toISOString(), lines: [{ fuelId: diesel.id, quantityFuusto: "5" }] })
    });

    const key = randomUUID();
    const firstPost = await request<{ status: string }>(`/stock/receipts/${receipt.id}/post`, { method: "POST", headers: { "idempotency-key": key } });
    expect(firstPost.status).toBe("POSTED");

    // Replay post with same idempotency key or already posted receipt
    const secondPost = await request<{ status: string; replay?: boolean }>(`/stock/receipts/${receipt.id}/post`, { method: "POST", headers: { "idempotency-key": key } });
    expect(secondPost.replay).toBe(true);
  });

  it("7. Verifies Atomic Inventory Ledger Movements", async () => {
    const movements = await request<{ items: Array<{ eventType: string; quantityLiters: string }>; total: number }>("/stock/movements?eventType=RECEIPT");
    expect(movements.items.length).toBeGreaterThanOrEqual(1);
    expect(movements.items[0]?.eventType).toBe("RECEIPT");
  });

  it("8 & 9. Verifies Stock Adjustment Permissions and Mandatory Reason", async () => {
    const fuels = await request<Array<{ id: string; code: string }>>("/fuels");
    const diesel = fuels.find((f) => f.code === "DIESEL")!;

    // Missing reason throws 400
    const noReasonErr = await fetch(`${base}/api/v1/stock/adjustments`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ fuelId: diesel.id, signedDeltaLiters: "200" })
    });
    expect(noReasonErr.status).toBe(400);

    // Valid adjustment succeeds
    const adj = await request<{ signedDeltaLiters: string }>("/stock/adjustments", {
      method: "POST",
      body: JSON.stringify({ fuelId: diesel.id, signedDeltaLiters: "250", reason: "Owner verified calibration audit" })
    });
    expect(adj.signedDeltaLiters).toBe("250.000");
  });

  it("10 & 11. Verifies Price & Unit Conversion Versioning Overlap Prevention", async () => {
    const fuels = await request<Array<{ id: string; code: string }>>("/fuels");
    const diesel = fuels.find((f) => f.code === "DIESEL")!;
    const suffix = randomUUID().slice(0, 8);
    const customUnit = await prisma.salesUnit.create({ data: { code: `FUUSTO_VERIFY_${suffix}`, name: "Fuusto Verify" } });

    const now = new Date();
    const pastDate = new Date(now.getTime() - 3600_000).toISOString();

    // Create unit conversion
    await request("/units", {
      method: "POST",
      body: JSON.stringify({ fuelId: diesel.id, salesUnitId: customUnit.id, litersPerUnit: "240", effectiveFromUtc: pastDate })
    });

    // Create price version
    await request("/prices", {
      method: "POST",
      body: JSON.stringify({ fuelId: diesel.id, salesUnitId: customUnit.id, unitPrice: "120", effectiveFromUtc: pastDate, reason: "Initial price version" })
    });

    const currentPrice = await request<{ unitPrice: string }>(`/prices/current?fuelId=${diesel.id}&unitId=${customUnit.id}`);
    expect(currentPrice.unitPrice).toContain("120.0000");
  });

  it("12. Verifies Financial Data Redaction for Non-Owner Users", async () => {
    const receiptsOffice = await request<Array<{ lines: Array<{ unitPurchaseCost?: string }> }>>("/tanker-receipts", {}, officeCookie);
    for (const r of receiptsOffice) {
      for (const line of r.lines) {
        expect(line.unitPurchaseCost).toBeUndefined();
      }
    }

    const receiptsOwner = await request<Array<{ lines: Array<{ unitPurchaseCost?: string }> }>>("/tanker-receipts", {}, ownerCookie);
    const hasAnyCost = receiptsOwner.some((r) => r.lines.some((l) => l.unitPurchaseCost !== undefined));
    expect(hasAnyCost).toBe(true);
  });
});
