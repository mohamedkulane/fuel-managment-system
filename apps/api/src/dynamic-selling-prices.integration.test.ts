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

describe("Dynamic Fuel Selling Prices & Snapshot Preservation Integration Suite", () => {
  let dieselId = "";
  let petrolId = "";
  let unitId = "";
  let customerId = "";
  let order1Id = "";
  let orderLine1Id = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-dsp-${suffix}@test.invalid`, displayName: "Owner Pricing Manager", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    const office = await prisma.user.create({
      data: { email: `office-dsp-${suffix}@test.invalid`, displayName: "Office Employee", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
    });

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    dieselId = diesel.id;

    const petrol = await prisma.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Petrol / Basiin" } });
    petrolId = petrol.id;

    const unit = await prisma.salesUnit.create({
      data: { code: `FUUSTO_DSP_${suffix}`, name: "Fuusto Standard 240L" }
    });
    unitId = unit.id;

    const initialDate = new Date(Date.now() - 3600_000).toISOString();
    // Fuel Unit Version (240 L / fuusto)
    await prisma.fuelUnitVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(initialDate), createdById: owner.id }
    });
    await prisma.fuelUnitVersion.create({
      data: { fuelId: petrol.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(initialDate), createdById: owner.id }
    });

    // Initial Selling Price: $100 per fuusto for Diesel on initialDate
    await prisma.priceVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("100"), effectiveFromUtc: new Date(initialDate), reason: "October 10 initial rate", createdById: owner.id }
    });

    // Warehouse Stock Setup
    for (const fuelId of [diesel.id, petrol.id]) {
      for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
        await prisma.stockBalance.upsert({
          where: { fuelId_location: { fuelId, location } },
          update: { balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") },
          create: { fuelId, location, balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") }
        });
      }
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-DSP-${suffix}`, name: "Somali Commercial Transport", primaryPhone: "+252618881122", createdById: owner.id }
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

  it("1. Verifies initial price is $100 per fuusto and price history records creator and reason", async () => {
    const history = await request<Array<{ salesUnitId: string; unitPrice: string; createdByName?: string; reason?: string }>>("/prices/history");
    const testPrice = history.find((p) => p.salesUnitId === unitId);
    expect(testPrice).toBeDefined();
    expect(Number(testPrice?.unitPrice)).toBe(100);
    expect(testPrice?.createdByName).toBe("Owner Pricing Manager");
    expect(testPrice?.reason).toBe("October 10 initial rate");
  });

  it("2. Creates Order #1 at $100 price snapshot and verifies snapshot preservation after price update to $150", async () => {
    // 1. Create order for 10 fuusto Diesel at $100 rate
    const order1 = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Hodan Yard 1",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "10" }]
      })
    });
    order1Id = order1.id;
    orderLine1Id = order1.lines[0]!.id;

    const confirmed1 = await request<{ lines: Array<{ unitPriceSnapshot: string }> }>(
      `/orders/${order1.id}/confirm`,
      { method: "POST", headers: { "idempotency-key": randomUUID() } }
    );
    expect(Number(confirmed1.lines[0]?.unitPriceSnapshot)).toBe(100);

    // 2. Owner updates Diesel selling price to $150 per fuusto
    const priceUpdateDate = new Date().toISOString();
    await request("/prices", {
      method: "POST",
      body: JSON.stringify({
        fuelId: dieselId,
        salesUnitId: unitId,
        unitPrice: "150",
        effectiveFromUtc: priceUpdateDate,
        reason: "October 11 price increase"
      })
    }, ownerCookie);

    // 3. Verify Order #1 retained original $100 agreed price snapshot
    const checkedOrder1 = await request<{ lines: Array<{ unitPriceSnapshot: string }> }>(`/orders/${order1.id}`);
    expect(Number(checkedOrder1.lines[0]?.unitPriceSnapshot)).toBe(100);
  });

  it("3. Verifies overlap prevention when submitting conflicting effective date range", async () => {
    const history = await request<Array<{ salesUnitId: string; effectiveFromUtc: string }>>("/prices/history");
    const activePrice = history.find((p) => p.salesUnitId === unitId)!;

    // Submitting an overlapping effective date must fail with 400 Bad Request
    const overlapErr = await fetch(`${base}/api/v1/prices`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        fuelId: dieselId,
        salesUnitId: unitId,
        unitPrice: "175",
        effectiveFromUtc: activePrice.effectiveFromUtc,
        reason: "Conflicting overlap attempt"
      })
    });
    expect(overlapErr.status).toBe(400);
  });

  it("4. Creates Order #2 after price increase -> snapshots new $150 rate at confirmation", async () => {
    const order2 = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Waberi Depot",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "15" }]
      })
    });

    const confirmed2 = await request<{ lines: Array<{ unitPriceSnapshot: string }> }>(
      `/orders/${order2.id}/confirm`,
      { method: "POST", headers: { "idempotency-key": randomUUID() } }
    );
    expect(Number(confirmed2.lines[0]?.unitPriceSnapshot)).toBe(150);
  });

  it("5. Verifies draft order detects current active market price before confirmation", async () => {
    const draftOrder = await request<{ id: string; lines: Array<{ currentActiveUnitPrice?: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Draft Review Address",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    });

    const fetchedDraft = await request<{ lines: Array<{ currentActiveUnitPrice?: string }> }>(`/orders/${draftOrder.id}`);
    expect(Number(fetchedDraft.lines[0]?.currentActiveUnitPrice)).toBe(150);
  });

  it("6. Verifies invoicing uses delivered accepted fuusto x price snapshot, preserving historical totals", async () => {
    // Deliver & Reconcile Order #1 (10 fuusto @ $100 = $1,000 total invoice)
    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [orderLine1Id] })
    });

    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: orderLine1Id, dispatchedUnits: "10" }] })
    });

    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    // Reconcile 10 accepted
    const conf = await request<{ id: string; lines: Array<{ id: string }> }>(`/dispatches/${dispatch.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [
          {
            dispatchLineId: dispatch.lines[0]!.id,
            acceptedUnits: "10",
            physicalReturnedLiters: "0",
            commercialDisposition: "NONE"
          }
        ]
      })
    });

    // Generate Invoice from reconciled delivery confirmation line
    const invoices = await request<Array<{ id: string; customerId: string; totalAmount: string; lines: Array<{ unitPriceSnapshot: string; lineTotal: string }> }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf.lines[0]!.id })
    });

    expect(invoices.length).toBe(1);
    expect(Number(invoices[0]?.totalAmount)).toBe(1000);
    expect(Number(invoices[0]?.lines[0]?.unitPriceSnapshot)).toBe(100);
  });

  it("7. Customer with existing unpaid invoice debt creates new order at updated selling price ($150)", async () => {
    // Customer currently has $1,000 debt from previous invoice
    const customer = await request<{ id: string; status: string }>(`/customers/${customerId}`);
    expect(customer.status).toBe("ACTIVE");

    // Can create new order at $150 rate
    const newOrder = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Second Order Yard",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "8" }]
      })
    });

    const confirmedNew = await request<{ status: string; lines: Array<{ unitPriceSnapshot: string }> }>(
      `/orders/${newOrder.id}/confirm`,
      { method: "POST", headers: { "idempotency-key": randomUUID() } }
    );

    expect(confirmedNew.status).toBe("CONFIRMED");
    expect(Number(confirmedNew.lines[0]?.unitPriceSnapshot)).toBe(150);
  });
});
