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
let app: INestApplication; let prisma: PrismaClient; let base = ""; let ownerCookie = ""; let officeCookie = ""; let testUnitCode = "";
const ownerPassword = `Owner-${randomUUID()}!`;
const officePassword = `Office-${randomUUID()}!`;
async function request<T>(path: string, options: RequestInit = {}, cookie = ownerCookie): Promise<T> {
  const response = await fetch(`${base}/api/v1${path}`, { ...options, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(options.headers ?? {}) } });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return ((await response.json()) as JsonResult<T>).data;
}

describe("Phase 1 and 2 HTTP workflow", () => {
  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    await prisma.user.createMany({ data: [
      { email: `owner-${suffix}@test.invalid`, displayName: "Test Owner", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) },
      { email: `office-${suffix}@test.invalid`, displayName: "Test Office", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
    ] });
    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    const petrol = await prisma.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Petrol / Basiin" } });
    testUnitCode = `FUUSTO_TEST_${suffix}`;
    await prisma.salesUnit.create({ data: { code: testUnitCode, name: "Fuusto integration fixture" } });
    for (const fuel of [diesel, petrol]) for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) await prisma.stockBalance.upsert({ where: { fuelId_location: { fuelId: fuel.id, location } }, update: { balanceLiters: new Prisma.Decimal(0) }, create: { fuelId: fuel.id, location, balanceLiters: new Prisma.Decimal(0) } });
    app = await NestFactory.create(AppModule, { logger: ["error"] }); app.use(cookieParser()); await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number }; base = `http://127.0.0.1:${address.port}`;
    for (const [email, password, target] of [[`owner-${suffix}@test.invalid`, ownerPassword, "owner"], [`office-${suffix}@test.invalid`, officePassword, "office"]] as const) {
      const response = await fetch(`${base}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) }); expect(response.status).toBe(201); const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? ""; if (target === "owner") ownerCookie = cookie; else officeCookie = cookie;
    }
  });
  afterAll(async () => { await app?.close(); await prisma?.$disconnect(); });

  it("preserves snapshots, keeps printing side-effect free, and reconciles 20/18/2", async () => {
    const fuels = await request<Array<{ id: string; code: string }>>("/fuels"); const diesel = fuels.find((item) => item.code === "DIESEL")!;
    const units = await request<Array<{ id: string; code: string }>>("/sales-units"); const unit = units.find((item) => item.code === testUnitCode)!; const effective = new Date(Date.now() - 60_000).toISOString();
    await request("/units", { method: "POST", body: JSON.stringify({ fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: "20", effectiveFromUtc: effective }) });
    await request("/prices", { method: "POST", body: JSON.stringify({ fuelId: diesel.id, salesUnitId: unit.id, unitPrice: "120", effectiveFromUtc: effective, reason: "integration fixture" }) });
    const customer = await request<{ id: string }>("/customers", { method: "POST", body: JSON.stringify({ name: "Integration Customer", primaryPhone: "+252000000", address: "Hodan" }) });
    const receipt = await request<{ id: string }>("/tanker-receipts", { method: "POST", body: JSON.stringify({ arrivedAt: new Date().toISOString(), lines: [{ fuelId: diesel.id, actualLiters: "1000", unitPurchaseCost: "1.25" }] }) });
    const postKey = randomUUID(); await request(`/tanker-receipts/${receipt.id}/post`, { method: "POST", headers: { "idempotency-key": postKey } }); await request(`/tanker-receipts/${receipt.id}/post`, { method: "POST", headers: { "idempotency-key": postKey } });
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", { method: "POST", body: JSON.stringify({ customerId: customer.id, addressSnapshot: "Hodan", requestedDeliveryDate: new Date().toISOString().slice(0, 10), lines: [{ fuelId: diesel.id, salesUnitId: unit.id, requestedUnits: "20" }] }) });
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    const sheet = await request<{ id: string }>("/delivery-sheets", { method: "POST", body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] }) });
    const beforePrint = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances");
    const manifest = await request<Record<string, unknown>>(`/delivery-sheets/${sheet.id}/manifest`); expect(JSON.stringify(manifest)).not.toMatch(/price|cost|debt|payment|profit|revenue|tax/i);
    const pdf = await fetch(`${base}/api/v1/delivery-sheets/${sheet.id}/pdf`, { headers: { cookie: ownerCookie } }); expect(pdf.status).toBe(200); expect(pdf.headers.get("content-type")).toContain("application/pdf");
    const afterPrint = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances"); expect(afterPrint).toEqual(beforePrint);
    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", { method: "POST", headers: { "idempotency-key": randomUUID() }, body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "20" }] }) });
    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    await request(`/dispatches/${dispatch.id}/reconcile`, { method: "POST", headers: { "idempotency-key": randomUUID() }, body: JSON.stringify({ lines: [{ dispatchLineId: dispatch.lines[0]!.id, acceptedUnits: "18", physicalReturnedLiters: "40", commercialDisposition: "CANCEL_REMAINDER", discrepancyReason: "Two fuusto refused and physically returned" }] }) });
    const detail = await request<{ status: string; lines: Array<{ requestedUnits: string; unitPriceSnapshot: string; litersPerUnitSnapshot: string; dispatchLines: Array<{ confirmations: Array<{ acceptedUnits: string; physicalReturnedLiters: string }> }> }> }>(`/orders/${order.id}`);
    expect(detail.status).toBe("PARTIALLY_FULFILLED"); expect(detail.lines[0]).toMatchObject({ requestedUnits: "20.000", unitPriceSnapshot: "120.000000", litersPerUnitSnapshot: "20.000000" }); expect(detail.lines[0]!.dispatchLines[0]!.confirmations[0]).toMatchObject({ acceptedUnits: "18.000", physicalReturnedLiters: "40.000" });
    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances"); expect(balances.find((item) => item.fuel === "DIESEL" && item.location === "WAREHOUSE")?.balanceLiters).toBe("640.000"); expect(balances.find((item) => item.fuel === "DIESEL" && item.location === "IN_TRANSIT")?.balanceLiters).toBe("0.000");
  });

  it("enforces owner-only masters and redacts tanker cost for office staff", async () => {
    const fuels = await request<Array<{ id: string }>>("/fuels", {}, officeCookie); const units = await request<Array<{ id: string }>>("/sales-units", {}, officeCookie);
    const denied = await fetch(`${base}/api/v1/prices`, { method: "POST", headers: { "content-type": "application/json", cookie: officeCookie }, body: JSON.stringify({ fuelId: fuels[0]!.id, salesUnitId: units[0]!.id, unitPrice: "999", effectiveFromUtc: new Date().toISOString() }) }); expect(denied.status).toBe(403);
    const receipts = await request<Array<{ lines: Array<Record<string, unknown>> }>>("/tanker-receipts", {}, officeCookie); expect(JSON.stringify(receipts)).not.toMatch(/unitPurchaseCost/);
    const noDriverRoute = await fetch(`${base}/api/v1/driver/dashboard`, { headers: { cookie: officeCookie } }); expect(noDriverRoute.status).toBe(404);
  });
});
