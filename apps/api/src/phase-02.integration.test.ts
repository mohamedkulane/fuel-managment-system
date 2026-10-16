import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@fuel/database";
import { STANDARD_OFFICE_PERMISSIONS } from "@fuel/shared";
import { AppModule } from "./app.module.js";

type JsonResult<T> = { data: T };
let app: INestApplication;
let prisma: PrismaClient;
let base = "";
let ownerCookie = "";
let officeCookie = "";

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

describe("Phase 2 Complete Workflow & Inventory Ledger Suite", () => {
  let dieselId = "";
  let unitId = "";
  let customerId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-p2-${suffix}@test.invalid`, displayName: "P2 Owner", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    const office = await prisma.user.create({
      data: { email: `office-p2-${suffix}@test.invalid`, displayName: "P2 Office", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
    });
    await prisma.userPermission.createMany({
      data: STANDARD_OFFICE_PERMISSIONS.map((permission) => ({
        userId: office.id,
        permission,
        grantedById: owner.id
      }))
    });

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    dieselId = diesel.id;

    const unit = await prisma.salesUnit.create({ data: { code: `FUUSTO_P2_${suffix}`, name: "Fuusto Standard 240L" } });
    unitId = unit.id;

    const effective = new Date(Date.now() - 3600_000).toISOString();
    await prisma.fuelUnitVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });
    await prisma.priceVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("120"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });

    for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
      await prisma.stockBalance.upsert({
        where: { fuelId_location: { fuelId: diesel.id, location } },
        update: { balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("10000") : new Prisma.Decimal("0") },
        create: { fuelId: diesel.id, location, balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("10000") : new Prisma.Decimal("0") }
      });
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-P2-${suffix}`, name: "Somali Logistics Corp", primaryPhone: "+252615554433", createdById: owner.id }
    });
    customerId = customer.id;

    app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;

    const resOwner = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: owner.email, password: ownerPassword })
    });
    ownerCookie = resOwner.headers.get("set-cookie")?.split(";")[0] ?? "";

    const resOffice = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: office.email, password: officePassword })
    });
    officeCookie = resOffice.headers.get("set-cookie")?.split(";")[0] ?? "";
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("1. Creates, Confirms, and Freezes Price/Conversion Snapshots", async () => {
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Hodan Depot 4",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "20" }]
      })
    });

    const confirmKey = randomUUID();
    const confirmed = await request<{ status: string; lines: Array<{ unitPriceSnapshot: string; litersPerUnitSnapshot: string }> }>(
      `/orders/${order.id}/confirm`,
      { method: "POST", headers: { "idempotency-key": confirmKey } }
    );

    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.lines[0]?.unitPriceSnapshot).toContain("120.0000");
    expect(confirmed.lines[0]?.litersPerUnitSnapshot).toBe("240.000000");

    // Updating master price does NOT affect confirmed order snapshot
    const futureDate = new Date(Date.now() + 300_000).toISOString();
    await request("/prices", {
      method: "POST",
      body: JSON.stringify({ fuelId: dieselId, salesUnitId: unitId, unitPrice: "250", effectiveFromUtc: futureDate, reason: "Price increase" })
    });

    const checkOrder = await request<{ lines: Array<{ unitPriceSnapshot: string }> }>(`/orders/${order.id}`);
    expect(checkOrder.lines[0]?.unitPriceSnapshot).toContain("120.0000");
  });

  it("2. Verifies Non-Financial Delivery Sheet & PDF Manifest Isolation", async () => {
    // Create new order to test delivery sheet
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Bakarah Market",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "20" }]
      })
    });
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });

    // Check JSON Manifest
    const manifest = await request<Record<string, unknown>>(`/delivery-sheets/${sheet.id}/manifest`);
    const manifestStr = JSON.stringify(manifest);
    expect(manifestStr).not.toMatch(/price|cost|debt|payment|revenue|profit|tax/i);

    // Check PDF Export Response Header & Binary status
    const pdfResponse = await fetch(`${base}/api/v1/delivery-sheets/${sheet.id}/pdf`, { headers: { cookie: officeCookie } });
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get("content-type")).toContain("application/pdf");
  });

  it("3. Verifies 20/18/2 Accepted/Returned Inventory Reconciliation Scenario", async () => {
    // Initial Stock: Warehouse 10000 L, In Transit 0 L
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Wadajir Station",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "20" }]
      })
    });
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });

    const dispatchKey = randomUUID();
    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": dispatchKey },
      body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "20" }] })
    });

    // Post Dispatch (20 fuusto * 240 L = 4,800 L dispatched)
    const postDispatchKey = randomUUID();
    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": postDispatchKey } });

    // Stock check after dispatch
    const balancesAfterDispatch = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances");
    const warehousePostDispatch = balancesAfterDispatch.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE")?.balanceLiters;
    const transitPostDispatch = balancesAfterDispatch.find((b) => b.fuel === "DIESEL" && b.location === "IN_TRANSIT")?.balanceLiters;
    expect(warehousePostDispatch).toBe("5200.000");
    expect(transitPostDispatch).toBe("4800.000");

    // Reconcile: 18 accepted (4,320 L), 2 returned (480 L)
    const reconcileKey = randomUUID();
    await request(`/dispatches/${dispatch.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": reconcileKey },
      body: JSON.stringify({
        lines: [
          {
            dispatchLineId: dispatch.lines[0]!.id,
            acceptedUnits: "18",
            physicalReturnedLiters: "480",
            commercialDisposition: "CANCEL_REMAINDER",
            discrepancyReason: "2 fuusto damaged and physically returned to warehouse"
          }
        ]
      })
    });

    // Final Stock Balances: Warehouse = 5,200 + 480 = 5,680 L, In Transit = 4,800 - 4,800 = 0 L
    const finalBalances = await request<Array<{ fuel: string; location: string; balanceLiters: string }>>("/stock/balances");
    const finalWarehouse = finalBalances.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE")?.balanceLiters;
    const finalTransit = finalBalances.find((b) => b.fuel === "DIESEL" && b.location === "IN_TRANSIT")?.balanceLiters;

    expect(finalWarehouse).toBe("5680.000");
    expect(finalTransit).toBe("0.000");

    // Check Order Status
    const updatedOrder = await request<{ status: string; lines: Array<{ dispatchLines: Array<{ confirmations: Array<{ billingSourceKey: string; acceptedUnits: string }> }> }> }>(`/orders/${order.id}`);
    expect(updatedOrder.status).toBe("PARTIALLY_FULFILLED");
    const confLine = updatedOrder.lines[0]?.dispatchLines[0]?.confirmations[0];
    expect(confLine?.acceptedUnits).toBe("18.000");
    expect(confLine?.billingSourceKey).toBeDefined();
  });

  it("4. Verifies Order Cancellation Endpoint", async () => {
    const order = await request<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Huriwaa District",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    });

    const cancelled = await request<{ status: string }>(`/orders/${order.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Customer requested order cancellation before dispatch" })
    });
    expect(cancelled.status).toBe("CANCELLED");
  });
});
