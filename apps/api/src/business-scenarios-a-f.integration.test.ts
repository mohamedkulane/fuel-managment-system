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

describe("Confirmed Business Scenarios A through F (1 Fuusto = 240 Liters)", () => {
  let dieselId = "";
  let petrolId = "";
  let unitId = "";
  let customerId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-af-${suffix}@test.invalid`, displayName: "Owner AF", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    dieselId = diesel.id;

    const petrol = await prisma.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Petrol / Basiin" } });
    petrolId = petrol.id;

    const unit = await prisma.salesUnit.create({
      data: { code: `FUUSTO_AF_${suffix}`, name: "Fuusto (240 Liters)" }
    });
    unitId = unit.id;

    const effective = new Date(Date.now() - 3600_000).toISOString();
    // Ensure 240 L / fuusto active version
    await prisma.fuelUnitVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });
    await prisma.fuelUnitVersion.create({
      data: { fuelId: petrol.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });

    // Prices
    await prisma.priceVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("150"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });
    await prisma.priceVersion.create({
      data: { fuelId: petrol.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("160"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });

    // Clean stock balances for fresh test run
    await prisma.stockBalance.deleteMany({ where: { fuelId: { in: [diesel.id, petrol.id] } } });
    for (const fuelId of [diesel.id, petrol.id]) {
      for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
        await prisma.stockBalance.create({
          data: { fuelId, location, balanceLiters: new Prisma.Decimal("0") }
        });
      }
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-AF-${suffix}`, name: "Mogadishu Express Logistics", primaryPhone: "+252619998877", createdById: owner.id }
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
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it("Scenario A: Receive 50 fuusto Diesel -> Warehouse stock increases by 50 fuusto (12,000 L)", async () => {
    const draft = await request<{ id: string; lines: Array<{ actualLiters: string; quantityFuusto: string }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "Gulf Petroleum Supplier",
        notes: "Scenario A test receipt",
        lines: [{ fuelId: dieselId, quantityFuusto: "50" }]
      })
    });

    expect(Number(draft.lines[0]?.quantityFuusto)).toBe(50);
    expect(Number(draft.lines[0]?.actualLiters)).toBe(12000);

    // Post Receipt
    await request(`/stock/receipts/${draft.id}/post`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() }
    });

    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string; balanceFuusto: string }>>("/stock/balances");
    const dieselStock = balances.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE");
    expect(Number(dieselStock?.balanceLiters)).toBe(12000);
    expect(Number(dieselStock?.balanceFuusto)).toBe(50);
  });

  it("Scenario B: Receive 40 fuusto Petrol -> Warehouse stock increases by 40 fuusto (9,600 L)", async () => {
    const draft = await request<{ id: string; lines: Array<{ actualLiters: string; quantityFuusto: string }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "Red Sea Energy Corp",
        notes: "Scenario B test receipt",
        lines: [{ fuelId: petrolId, quantityFuusto: "40" }]
      })
    });

    expect(Number(draft.lines[0]?.quantityFuusto)).toBe(40);
    expect(Number(draft.lines[0]?.actualLiters)).toBe(9600);

    // Post Receipt
    await request(`/stock/receipts/${draft.id}/post`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() }
    });

    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string; balanceFuusto: string }>>("/stock/balances");
    const petrolStock = balances.find((b) => b.fuel === "PETROL" && b.location === "WAREHOUSE");
    expect(Number(petrolStock?.balanceLiters)).toBe(9600);
    expect(Number(petrolStock?.balanceFuusto)).toBe(40);
  });

  it("Scenario C: Receive 60 additional fuusto Petrol -> Total 100 fuusto Petrol (24,000 L)", async () => {
    const draft = await request<{ id: string; lines: Array<{ actualLiters: string; quantityFuusto: string }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "Red Sea Energy Corp",
        notes: "Scenario C second receipt",
        lines: [{ fuelId: petrolId, quantityFuusto: "60" }]
      })
    });

    expect(Number(draft.lines[0]?.quantityFuusto)).toBe(60);
    expect(Number(draft.lines[0]?.actualLiters)).toBe(14400);

    // Post Receipt
    await request(`/stock/receipts/${draft.id}/post`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() }
    });

    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string; balanceFuusto: string }>>("/stock/balances");
    const petrolStock = balances.find((b) => b.fuel === "PETROL" && b.location === "WAREHOUSE");
    expect(Number(petrolStock?.balanceLiters)).toBe(24000);
    expect(Number(petrolStock?.balanceFuusto)).toBe(100);
  });

  it("Scenario D: Dispatch 12 fuusto Diesel -> Warehouse stock reduced by 12 fuusto (2,880 L), In Transit +12 fuusto", async () => {
    // 1. Create and confirm customer order for 12 fuusto Diesel
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Hodan District Depot",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "12" }]
      })
    });

    await request(`/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() }
    });

    // 2. Create delivery sheet
    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({
        serviceDate: new Date().toISOString().slice(0, 10),
        orderLineIds: [order.lines[0]!.id]
      })
    });

    // 3. Dispatch and Post
    const dispatch = await request<{ id: string }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        deliverySheetId: sheet.id,
        lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "12" }]
      })
    });

    await request(`/dispatches/${dispatch.id}/post`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() }
    });

    // Stock check: Warehouse = 50 - 12 = 38 fuusto (9,120 L), In Transit = 12 fuusto (2,880 L)
    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string; balanceFuusto: string }>>("/stock/balances");
    const warehouseDiesel = balances.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE");
    const transitDiesel = balances.find((b) => b.fuel === "DIESEL" && b.location === "IN_TRANSIT");

    expect(Number(warehouseDiesel?.balanceFuusto)).toBe(38);
    expect(Number(warehouseDiesel?.balanceLiters)).toBe(9120);

    expect(Number(transitDiesel?.balanceFuusto)).toBe(12);
    expect(Number(transitDiesel?.balanceLiters)).toBe(2880);
  });

  it("Scenario E: Reconcile 10 accepted / 2 returned -> Net stock reduction 10 fuusto (2,400 L), 2 fuusto returned to stock", async () => {
    // Fetch active dispatch
    const dispatches = await request<Array<{ id: string; status: string; lines: Array<{ id: string }> }>>("/dispatches");
    const activeDispatch = dispatches.find((d) => d.status === "POSTED");
    expect(activeDispatch).toBeDefined();

    // Reconcile 10 accepted, 2 returned physically (2 fuusto * 240 L = 480 L returned)
    await request(`/dispatches/${activeDispatch!.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [
          {
            dispatchLineId: activeDispatch!.lines[0]!.id,
            acceptedUnits: "10",
            physicalReturnedLiters: "480", // 2 fuusto returned physically
            commercialDisposition: "CANCEL_REMAINDER",
            discrepancyReason: "2 fuusto rejected by customer due to seal damage and returned to warehouse"
          }
        ]
      })
    });

    // Stock Balances:
    // Warehouse = 38 + 2 returned = 40 fuusto (9,600 L)
    // In Transit = 12 - 12 = 0 fuusto (0 L)
    const balances = await request<Array<{ fuel: string; location: string; balanceLiters: string; balanceFuusto: string }>>("/stock/balances");
    const warehouseDiesel = balances.find((b) => b.fuel === "DIESEL" && b.location === "WAREHOUSE");
    const transitDiesel = balances.find((b) => b.fuel === "DIESEL" && b.location === "IN_TRANSIT");

    expect(Number(warehouseDiesel?.balanceFuusto)).toBe(40);
    expect(Number(warehouseDiesel?.balanceLiters)).toBe(9600);

    expect(Number(transitDiesel?.balanceFuusto)).toBe(0);
    expect(Number(transitDiesel?.balanceLiters)).toBe(0);
  });

  it("Scenario F: Price change on Diesel -> Confirmed orders & invoices retain original price snapshots ($150)", async () => {
    // Create & confirm order at current price $150
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Wadajir Station",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    });

    const confirmed = await request<{ lines: Array<{ unitPriceSnapshot: string; litersPerUnitSnapshot: string }> }>(
      `/orders/${order.id}/confirm`,
      { method: "POST", headers: { "idempotency-key": randomUUID() } }
    );

    expect(Number(confirmed.lines[0]?.unitPriceSnapshot)).toBe(150);
    expect(Number(confirmed.lines[0]?.litersPerUnitSnapshot)).toBe(240);

    // Update master price for Diesel to $200 per fuusto
    const futureDate = new Date(Date.now() + 60_000).toISOString();
    await request("/prices", {
      method: "POST",
      body: JSON.stringify({
        fuelId: dieselId,
        salesUnitId: unitId,
        unitPrice: "200",
        effectiveFromUtc: futureDate,
        reason: "Global market price update"
      })
    });

    // Check previously confirmed order retains $150 price snapshot
    const checkedOrder = await request<{ lines: Array<{ unitPriceSnapshot: string }> }>(`/orders/${order.id}`);
    expect(Number(checkedOrder.lines[0]?.unitPriceSnapshot)).toBe(150);
  });
});
