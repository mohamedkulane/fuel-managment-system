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

describe("Fixed Order-Level Discount Integration Suite", () => {
  let dieselId = "";
  let unitId = "";
  let customerId = "";
  let ownerUserId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-disc-${suffix}@test.invalid`, displayName: "Owner Discount Approver", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    ownerUserId = owner.id;

    const office = await prisma.user.create({
      data: { email: `office-disc-${suffix}@test.invalid`, displayName: "Office Staff", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
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

    const unit = await prisma.salesUnit.create({
      data: { code: `FUUSTO_DISC_${suffix}`, name: "Fuusto Standard 240L" }
    });
    unitId = unit.id;

    const initialDate = new Date(Date.now() - 3600_000).toISOString();
    await prisma.fuelUnitVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("240"), effectiveFromUtc: new Date(initialDate), createdById: owner.id }
    });
    await prisma.priceVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("100"), effectiveFromUtc: new Date(initialDate), reason: "Base $100 rate", createdById: owner.id }
    });

    for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
      await prisma.stockBalance.upsert({
        where: { fuelId_location: { fuelId: diesel.id, location } },
        update: { balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") },
        create: { fuelId: diesel.id, location, balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") }
      });
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-DISC-${suffix}`, name: "Somali Logistics Corp", primaryPhone: "+252619990011", createdById: owner.id }
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

  it("1. OFFICE_EMPLOYEE creates draft order with $10 fixed discount -> discount recorded, approval pending", async () => {
    const order = await request<{ id: string; fixedDiscountAmount: string; discountApprovedByName: string | null }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "K4 Yard",
        fixedDiscountAmount: "10.00",
        discountReason: "Volume negotiation",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, officeCookie);

    expect(Number(order.fixedDiscountAmount)).toBe(10);
    expect(order.discountApprovedByName).toBeNull();
  });

  it("2. OFFICE_EMPLOYEE fails to confirm order with unapproved discount (403 Forbidden)", async () => {
    const order = await request<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "K4 Yard",
        fixedDiscountAmount: "10.00",
        discountReason: "Volume negotiation",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, officeCookie);

    const err = await fetch(`${base}/api/v1/orders/${order.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: officeCookie, "idempotency-key": randomUUID() }
    });
    expect(err.status).toBe(403);
  });

  it("3. OWNER approves discount and OFFICE_EMPLOYEE confirms order -> Subtotal $500, Discount $10, Net Total $490", async () => {
    const order = await request<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "K4 Yard",
        fixedDiscountAmount: "10.00",
        discountReason: "Owner negotiated deal",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, officeCookie);

    // Owner approves discount
    const approved = await request<{ status: string; subtotal: string; fixedDiscountAmount: string; totalAmount: string; discountApprovedByName: string }>(`/orders/${order.id}/approve-discount`, {
      method: "POST",
      body: JSON.stringify({ reason: "Owner authorized discount" })
    }, ownerCookie);

    expect(approved.discountApprovedByName).toBe("Owner Discount Approver");

    // Approval confirms and snapshots the discounted order in one owner action.
    expect(approved.status).toBe("CONFIRMED");
    expect(Number(approved.subtotal)).toBe(500);
    expect(Number(approved.fixedDiscountAmount)).toBe(10);
    expect(Number(approved.totalAmount)).toBe(490);
  });

  it("4. Full delivery of 5 Fuusto -> Invoiced at $490 net ($500 - $10) and Customer Ledger debited $490", async () => {
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Bakarah Depot",
        fixedDiscountAmount: "10.00",
        discountReason: "Owner direct sale",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, ownerCookie); // Owner creating order auto-approves discount

    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    // Schedule, dispatch and reconcile 5 Fuusto accepted
    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });
    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "5" }] })
    });
    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    const conf = await request<{ id: string; lines: Array<{ id: string }> }>(`/dispatches/${dispatch.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [{ dispatchLineId: dispatch.lines[0]!.id, acceptedUnits: "5", physicalReturnedLiters: "0", commercialDisposition: "NONE" }]
      })
    });

    // Generate Invoice
    const invoices = await request<Array<{ id: string; invoiceNo: string; subtotal: string; discountAmount: string; totalAmount: string }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf.lines[0]!.id })
    });

    expect(invoices.length).toBe(1);
    expect(Number(invoices[0]?.subtotal)).toBe(500);
    expect(Number(invoices[0]?.discountAmount)).toBe(10);
    expect(Number(invoices[0]?.totalAmount)).toBe(490);

    // Customer financial ledger check
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, include: { ledgerEntries: { orderBy: { occurredAt: "desc" } } } });
    const invLedger = customer.ledgerEntries.find((e) => e.referenceNo === invoices[0]?.invoiceNo);
    expect(invLedger).toBeDefined();
    expect(Number(invLedger?.debitAmount)).toBe(490);
  });

  it("5. Partial delivery allocation -> Pro-rates discount across multiple invoices without exceeding order discount", async () => {
    // 5 Fuusto @ $100 = $500 subtotal, $10 fixed discount ($490 net total)
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Partial Delivery Yard",
        fixedDiscountAmount: "10.00",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, ownerCookie);
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    // Delivery 1: 3 Fuusto dispatched & accepted
    const sheet1 = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });
    const dispatch1 = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet1.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "3" }] })
    });
    await request(`/dispatches/${dispatch1.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    const conf1 = await request<{ id: string; lines: Array<{ id: string }> }>(`/dispatches/${dispatch1.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [{ dispatchLineId: dispatch1.lines[0]!.id, acceptedUnits: "3", physicalReturnedLiters: "0", commercialDisposition: "NONE" }]
      })
    });
    const inv1 = await request<Array<{ subtotal: string; discountAmount: string; totalAmount: string }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf1.lines[0]!.id })
    });

    // Invoice 1: 3 Fuusto = $300 subtotal, $6 discount (3/5 of $10), $294 total
    expect(Number(inv1[0]?.subtotal)).toBe(300);
    expect(Number(inv1[0]?.discountAmount)).toBe(6);
    expect(Number(inv1[0]?.totalAmount)).toBe(294);

    // Delivery 2: Remaining 2 Fuusto dispatched & accepted
    const sheet2 = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });
    const dispatch2 = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet2.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "2" }] })
    });
    await request(`/dispatches/${dispatch2.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    const conf2 = await request<{ id: string; lines: Array<{ id: string }> }>(`/dispatches/${dispatch2.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [{ dispatchLineId: dispatch2.lines[0]!.id, acceptedUnits: "2", physicalReturnedLiters: "0", commercialDisposition: "NONE" }]
      })
    });
    const inv2 = await request<Array<{ subtotal: string; discountAmount: string; totalAmount: string }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf2.lines[0]!.id })
    });

    // Invoice 2: 2 Fuusto = $200 subtotal, $4 discount (remaining of $10), $196 total
    expect(Number(inv2[0]?.subtotal)).toBe(200);
    expect(Number(inv2[0]?.discountAmount)).toBe(4);
    expect(Number(inv2[0]?.totalAmount)).toBe(196);

    // Cumulative check
    expect(Number(inv1[0]?.discountAmount) + Number(inv2[0]?.discountAmount)).toBe(10);
    expect(Number(inv1[0]?.totalAmount) + Number(inv2[0]?.totalAmount)).toBe(490);
  });

  it("6. Validation: Rejects negative discounts and discounts exceeding subtotal", async () => {
    // Negative discount
    const negErr = await fetch(`${base}/api/v1/orders`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Err Yard",
        fixedDiscountAmount: "-10.00",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    });
    expect(negErr.status).toBe(400);

    // Discount exceeding subtotal ($600 discount on $500 subtotal order)
    const exceedOrder = await request<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        addressSnapshot: "Err Yard 2",
        fixedDiscountAmount: "600.00",
        lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }]
      })
    }, ownerCookie);

    const exceedErr = await fetch(`${base}/api/v1/orders/${exceedOrder.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie, "idempotency-key": randomUUID() }
    });
    expect(exceedErr.status).toBe(400);
  });
});
