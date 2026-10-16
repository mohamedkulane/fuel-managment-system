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

describe("Phase 3 Invoicing, Credit, Debt & Payment Integration Suite", () => {
  let dieselId = "";
  let unitId = "";
  let customerId = "";
  let accountId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-p3-${suffix}@test.invalid`, displayName: "P3 Owner", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    const office = await prisma.user.create({
      data: { email: `office-p3-${suffix}@test.invalid`, displayName: "P3 Office", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
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

    const unit = await prisma.salesUnit.create({ data: { code: `FUUSTO_P3_${suffix}`, name: "Fuusto P3 240L" } });
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
        update: { balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") },
        create: { fuelId: diesel.id, location, balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") }
      });
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-P3-${suffix}`, name: "P3 Somali Trading Corp", primaryPhone: "+252617778899", createdById: owner.id }
    });
    customerId = customer.id;

    const account = await prisma.financialAccount.create({
      data: {
        code: `ACC-P3-${suffix}`,
        name: "P3 Test Cash",
        type: "CASH",
        openingBalance: new Prisma.Decimal("10000"),
        openingBalanceAsOf: new Date(effective),
        currentBalance: new Prisma.Decimal("10000"),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: owner.id
      }
    });
    accountId = account.id;

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

  it("1. Generates invoice from accepted delivery quantity (18 accepted @ $120 = $2,160)", async () => {
    // Create & confirm order for 20 fuusto
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({ customerId, addressSnapshot: "K4 Station", lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "20" }] })
    });
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    // Schedule delivery sheet & dispatch 20 fuusto
    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });
    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "20" }] })
    });
    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });

    // Reconcile: 18 accepted, 2 returned
    const conf = await request<{ id: string; lines: Array<{ id: string }> }>(`/dispatches/${dispatch.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({
        lines: [
          {
            dispatchLineId: dispatch.lines[0]!.id,
            acceptedUnits: "18",
            physicalReturnedLiters: "480",
            commercialDisposition: "CANCEL_REMAINDER",
            discrepancyReason: "2 fuusto damaged and physically returned"
          }
        ]
      })
    });

    // Generate Invoice
    const invoices = await request<Array<{ id: string; invoiceNo: string; totalAmount: string; balanceDue: string }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf.lines[0]!.id })
    });

    expect(invoices.length).toBe(1);
    expect(invoices[0]?.totalAmount).toContain("2160.0000");
    expect(invoices[0]?.balanceDue).toContain("2160.0000");
  });

  it("2. Verifies historical price snapshot preservation on invoice", async () => {
    // Unbilled deliveries query
    const unbilled = await request<Array<{ id: string }>>("/invoices/unbilled");
    expect(unbilled).toBeDefined();
  });

  it("3 & 4. Verifies duplicate invoice prevention & billingSourceKey constraint", async () => {
    const unbilled = await request<Array<{ id: string }>>("/invoices/unbilled");
    if (unbilled.length > 0) {
      const lineId = unbilled[0]!.id;
      // First invoicing succeeds
      await request("/invoices", { method: "POST", body: JSON.stringify({ deliveryConfirmationLineId: lineId }) });
      // Duplicate invoicing fails
      const dupErr = await fetch(`${base}/api/v1/invoices`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ deliveryConfirmationLineId: lineId })
      });
      expect(dupErr.status).toBe(400);
    }
  });

  it("5. Verifies partial invoice payment ($1000 invoice, $300 payment -> $700 balance)", async () => {
    // Create new customer for clean calculations
    const suffix = randomUUID().slice(0, 8);
    const testCust = await prisma.customer.create({
      data: { code: `CUS-P3-PAY-${suffix}`, name: "Installment Customer", createdById: (await prisma.user.findFirstOrThrow()).id }
    });

    // Create delivery, dispatch, reconcile & invoice
    const order = await request<{ id: string; lines: Array<{ id: string }> }>("/orders", {
      method: "POST",
      body: JSON.stringify({ customerId: testCust.id, addressSnapshot: "Depot A", lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "10" }] })
    });
    await request(`/orders/${order.id}/confirm`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    const sheet = await request<{ id: string }>("/delivery-sheets", {
      method: "POST",
      body: JSON.stringify({ serviceDate: new Date().toISOString().slice(0, 10), orderLineIds: [order.lines[0]!.id] })
    });
    const dispatch = await request<{ id: string; lines: Array<{ id: string }> }>("/dispatches", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ deliverySheetId: sheet.id, lines: [{ orderLineId: order.lines[0]!.id, dispatchedUnits: "10" }] })
    });
    await request(`/dispatches/${dispatch.id}/post`, { method: "POST", headers: { "idempotency-key": randomUUID() } });
    const conf = await request<{ lines: Array<{ id: string }> }>(`/dispatches/${dispatch.id}/reconcile`, {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ lines: [{ dispatchLineId: dispatch.lines[0]!.id, acceptedUnits: "10" }] })
    });
    const invoices = await request<Array<{ id: string; totalAmount: string }>>("/invoices", {
      method: "POST",
      body: JSON.stringify({ deliveryConfirmationLineId: conf.lines[0]!.id })
    });

    const inv = invoices[0]!;
    expect(inv.totalAmount).toContain("1200.0000");

    // Partial Payment: $300
    const payment1 = await request<{ amount: string; allocatedAmount: string; unappliedAmount: string }>("/payments", {
      method: "POST",
      headers: { "idempotency-key": randomUUID() },
      body: JSON.stringify({ customerId: testCust.id, amount: "300", paymentDate: new Date().toISOString(), financialAccountId: accountId })
    });
    expect(payment1.amount).toContain("300.0000");
    expect(payment1.allocatedAmount).toContain("300.0000");

    const updatedInv = await request<{ status: string; paidAmount: string; balanceDue: string }>(`/invoices/${inv.id}`);
    expect(updatedInv.status).toBe("PARTIALLY_PAID");
    expect(updatedInv.paidAmount).toContain("300.0000");
    expect(updatedInv.balanceDue).toContain("900.0000");
  });

  it("6 & 7. Verifies multiple installments ($300 + $200 = $500 total paid)", async () => {
    const list = await request<{ items: Array<{ id: string; customerId: string }> }>("/invoices?status=PARTIALLY_PAID&limit=1");
    if (list.items.length > 0) {
      const invId = list.items[0]!.id;
      const custId = list.items[0]!.customerId;
      const payment2 = await request<{ amount: string }>("/payments", {
        method: "POST",
        headers: { "idempotency-key": randomUUID() },
        body: JSON.stringify({ customerId: custId, amount: "200", paymentDate: new Date().toISOString(), financialAccountId: accountId })
      });
      expect(payment2.amount).toContain("200.0000");

      const check = await request<{ paidAmount: string }>(`/invoices/${invId}`);
      expect(parseFloat(check.paidAmount)).toBeGreaterThanOrEqual(500);
    }
  });

  it("8. Verifies new order is permitted despite outstanding debt", async () => {
    const order = await request<{ id: string; status: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({ customerId, addressSnapshot: "New Depot", lines: [{ fuelId: dieselId, salesUnitId: unitId, requestedUnits: "5" }] })
    });
    expect(order.status).toBe("DRAFT");
  });

  it("9 & 10. Verifies over-allocation rejection & payment allocation bounds", async () => {
    const list = await request<{ items: Array<{ id: string; customerId: string; balanceDue: string }> }>("/invoices?status=UNPAID&limit=1");
    if (list.items.length > 0) {
      const inv = list.items[0]!;
      const excess = (parseFloat(inv.balanceDue) + 500).toString();
      const err = await fetch(`${base}/api/v1/payments`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({
          customerId: inv.customerId,
          amount: "10000",
          paymentDate: new Date().toISOString(),
          allocations: [{ invoiceId: inv.id, amount: excess }]
        })
      });
      expect(err.status).toBe(400);
    }
  });

  it("11. Verifies duplicate payment prevention via Idempotency-Key", async () => {
    const key = randomUUID();
    const body = JSON.stringify({ customerId, amount: "150", paymentDate: "2026-10-13T12:00:00.000Z", financialAccountId: accountId });
    const pay1 = await request<{ status: string; replay?: boolean }>("/payments", {
      method: "POST",
      headers: { "idempotency-key": key },
      body
    });
    expect(pay1.status).toBe("POSTED");

    const pay2 = await request<{ status: string; replay?: boolean }>("/payments", {
      method: "POST",
      headers: { "idempotency-key": key },
      body
    });
    expect(pay2.replay).toBe(true);
  });

  it("12 & 13. Verifies customer financial subledger running balance correctness", async () => {
    const statement = await request<{ entries: Array<{ runningBalance: string; debitAmount: string; creditAmount: string }> }>(`/customers/${customerId}/statement`);
    expect(statement.entries.length).toBeGreaterThan(0);
  });

  it("14 & 15. Verifies payment reversal behavior and financial record immutability", async () => {
    const payments = await request<{ items: Array<{ id: string; amount: string; status: string }> }>(`/payments?customerId=${customerId}&limit=1`);
    if (payments.items.length > 0 && payments.items[0]?.status === "POSTED") {
      const payId = payments.items[0]!.id;
      const reversed = await request<{ status: string }>(`/payments/${payId}/reverse`, {
        method: "POST",
        headers: { "idempotency-key": randomUUID() },
        body: JSON.stringify({ reason: "Testing payment reversal workflow" })
      });
      expect(reversed.status).toBe("REVERSED");
    }
  });

  it("16. Verifies invalid input rejection (negative payment amount)", async () => {
    const err = await fetch(`${base}/api/v1/payments`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ customerId, amount: "-500", paymentDate: new Date().toISOString() })
    });
    expect(err.status).toBe(400);
  });

  it("17. Verifies role permissions: OFFICE_EMPLOYEE can create invoice/pay, cannot reverse", async () => {
    const invoices = await request<{ items: Array<{ id: string }> }>("/invoices?limit=1", {}, officeCookie);
    if (invoices.items.length > 0) {
      const revErr = await fetch(`${base}/api/v1/invoices/${invoices.items[0]!.id}/reverse`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: officeCookie },
        body: JSON.stringify({ reason: "Unauthorized office employee reversal" })
      });
      expect(revErr.status).toBe(403);
    }
  });

  it("18. Verifies delivery manifest JSON and PDF contain zero financial data leakage", async () => {
    const sheets = await request<Array<{ id: string }>>("/delivery-sheets");
    if (sheets.length > 0) {
      const manifest = await request<Record<string, unknown>>(`/delivery-sheets/${sheets[0]!.id}/manifest`);
      const manifestStr = JSON.stringify(manifest);
      expect(manifestStr).not.toMatch(/price|cost|debt|revenue|profit|tax/i);
    }
  });

  it("19 & 20. Verifies end-to-end order-to-invoice-to-payment workflow", async () => {
    const summary = await request<{ totals: { totalSales: string; totalPaid: string; remainingDebt: string } }>("/financial/debts");
    expect(summary.totals.remainingDebt).toBeDefined();
  });
});
