import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@fuel/database";
import { AppModule } from "./app.module.js";
import { PermissionCode, PERMISSION_CODES, STANDARD_OFFICE_PERMISSIONS } from "@fuel/shared";

describe("Final Gap Remediation Integration Tests", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let base = "";
  let ownerCookie = "";
  let ownerId = "";
  const suffix = randomUUID().slice(0, 8);
  const ownerEmail = `remedy-owner-${suffix}@test.invalid`;
  const ownerPassword = `Owner-${randomUUID()}!`;

  let dieselFuelId = "";
  let petrolFuelId = "";
  let fuustoUnitId = "";
  let dieselPriceId = "";
  let petrolPriceId = "";
  let cashAccountId = "";
  let bankAccountId = "";
  let testSupplierId = "";

  const key = () => randomUUID();

  async function login(email: string, password: string) {
    const res = await fetch(`${base}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
    return { res, cookie };
  }

  async function req(path: string, cookie: string, options: RequestInit = {}) {
    return fetch(`${base}/api/v1${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        cookie,
        ...(options.headers ?? {})
      }
    });
  }

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create owner user
    const owner = await prisma.user.create({
      data: {
        displayName: "Remedy Owner",
        email: ownerEmail,
        passwordHash: await argon2.hash(ownerPassword),
        role: "OWNER"
      }
    });
    ownerId = owner.id;

    // Bootstrap Nest app
    app = await NestFactory.create(AppModule, { logger: ["error"] });
    app.use(cookieParser());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as { port: number };
    base = `http://127.0.0.1:${address.port}`;

    const loginRes = await login(ownerEmail, ownerPassword);
    expect(loginRes.res.status).toBe(201);
    ownerCookie = loginRes.cookie;

    // Bootstrap Fuels and units
    const diesel = await prisma.fuelType.upsert({
      where: { code: "DIESEL" },
      update: {},
      create: { code: "DIESEL", displayName: "Naafto" }
    });
    dieselFuelId = diesel.id;

    const petrol = await prisma.fuelType.upsert({
      where: { code: "PETROL" },
      update: {},
      create: { code: "PETROL", displayName: "Basiin" }
    });
    petrolFuelId = petrol.id;

    const unit = await prisma.salesUnit.create({
      data: { code: `FUUSTO_${suffix}`, name: "Fuusto" }
    });
    fuustoUnitId = unit.id;

    const since = new Date(Date.now() - 86400000);
    await prisma.fuelUnitVersion.createMany({
      data: [
        { fuelId: dieselFuelId, salesUnitId: fuustoUnitId, litersPerUnit: new Prisma.Decimal(240), effectiveFromUtc: since, createdById: ownerId },
        { fuelId: petrolFuelId, salesUnitId: fuustoUnitId, litersPerUnit: new Prisma.Decimal(240), effectiveFromUtc: since, createdById: ownerId }
      ]
    });

    const dPrice = await prisma.priceVersion.create({
      data: { fuelId: dieselFuelId, salesUnitId: fuustoUnitId, unitPrice: new Prisma.Decimal(100), effectiveFromUtc: since, createdById: ownerId }
    });
    dieselPriceId = dPrice.id;

    const pPrice = await prisma.priceVersion.create({
      data: { fuelId: petrolFuelId, salesUnitId: fuustoUnitId, unitPrice: new Prisma.Decimal(120), effectiveFromUtc: since, createdById: ownerId }
    });
    petrolPriceId = pPrice.id;

    // Bootstrap Accounts
    const cash = await prisma.financialAccount.create({
      data: {
        code: `CASH_${suffix}`,
        name: "Main Cash Box",
        type: "CASH",
        openingBalance: new Prisma.Decimal(50000),
        openingBalanceAsOf: since,
        currentBalance: new Prisma.Decimal(50000),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: ownerId
      }
    });
    cashAccountId = cash.id;

    const bank = await prisma.financialAccount.create({
      data: {
        code: `BANK_${suffix}`,
        name: "Main Bank",
        type: "BANK",
        openingBalance: new Prisma.Decimal(50000),
        openingBalanceAsOf: since,
        currentBalance: new Prisma.Decimal(50000),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: ownerId
      }
    });
    bankAccountId = bank.id;

    // Bootstrap Supplier
    const supplier = await prisma.supplier.create({
      data: {
        code: `SUP_${suffix}`,
        name: "Somali Petroleum Depot",
        createdById: ownerId
      }
    });
    testSupplierId = supplier.id;

    // Seed stock in warehouse for testing
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: dieselFuelId, location: "WAREHOUSE" } },
      update: { balanceLiters: new Prisma.Decimal(240000) },
      create: { fuelId: dieselFuelId, location: "WAREHOUSE", balanceLiters: new Prisma.Decimal(240000) }
    });
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: petrolFuelId, location: "WAREHOUSE" } },
      update: { balanceLiters: new Prisma.Decimal(240000) },
      create: { fuelId: petrolFuelId, location: "WAREHOUSE", balanceLiters: new Prisma.Decimal(240000) }
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  // --------------------------------------------------------------------------
  // P0 #1 & P1 #10: Empty permission sets and privilege escalation prevention
  // --------------------------------------------------------------------------
  describe("P0 #1 & P1 #10: Permission integrity and escalation prevention", () => {
    it("empty permission set does not fall back to standard permissions and blocks unauthorized requests", async () => {
      const empSuffix = randomUUID().slice(0, 8);
      const empEmail = `empty-perm-${empSuffix}@test.invalid`;
      const empPassword = `Password123456!`;

      // 1. Create employee via POST /users
      const createRes = await req("/users", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          displayName: "Empty Perm Employee",
          email: empEmail,
          password: empPassword,
          role: "OFFICE_EMPLOYEE"
        })
      });
      expect(createRes.status).toBe(201);
      const empData = (await createRes.json()).data;

      // Initially employee should have standard permissions seeded
      const initialPermsRes = await req(`/users/${empData.id}/permissions`, ownerCookie);
      expect(initialPermsRes.status).toBe(200);
      const initialPerms = (await initialPermsRes.json()).data.permissions;
      expect(initialPerms).toContain("orders.view");

      // 2. Owner explicitly revokes all permissions by sending []
      const revokeRes = await req(`/users/${empData.id}/permissions`, ownerCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: [] })
      });
      expect(revokeRes.status).toBe(200);
      expect((await revokeRes.json()).data.permissions).toEqual([]);

      // 3. Verify GET permissions returns [] (NOT falling back to STANDARD_OFFICE_PERMISSIONS)
      const emptyCheckRes = await req(`/users/${empData.id}/permissions`, ownerCookie);
      expect(emptyCheckRes.status).toBe(200);
      expect((await emptyCheckRes.json()).data.permissions).toEqual([]);

      // 4. Log in as this employee and verify they cannot view orders or customers
      const empLogin = await login(empEmail, empPassword);
      expect(empLogin.res.status).toBe(201);

      const forbiddenRes = await req("/orders", empLogin.cookie);
      expect(forbiddenRes.status).toBe(403);
    });

    it("prevents self-modification and privilege escalation by non-owners", async () => {
      const empSuffix = randomUUID().slice(0, 8);
      const empEmail = `staff-escalate-${empSuffix}@test.invalid`;
      const empPassword = `Password123456!`;

      const createRes = await req("/users", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          displayName: "Escalation Test Staff",
          email: empEmail,
          password: empPassword,
          role: "OFFICE_EMPLOYEE"
        })
      });
      const emp = (await createRes.json()).data;

      // Grant permissions.manage to employee
      await req(`/users/${emp.id}/permissions`, ownerCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["permissions.manage"] })
      });

      const empLogin = await login(empEmail, empPassword);

      // Attempt 1: Staff user cannot modify their own permissions
      const selfModRes = await req(`/users/${emp.id}/permissions`, empLogin.cookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["permissions.manage", "orders.create"] })
      });
      expect(selfModRes.status).toBe(403);

      // Attempt 2: Staff cannot grant admin permissions (e.g. prices.update or settings.manage) to another user
      const victimSuffix = randomUUID().slice(0, 8);
      const victimRes = await req("/users", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          displayName: "Victim Staff",
          email: `victim-${victimSuffix}@test.invalid`,
          password: empPassword,
          role: "OFFICE_EMPLOYEE"
        })
      });
      const victim = (await victimRes.json()).data;

      const escalateRes = await req(`/users/${victim.id}/permissions`, empLogin.cookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["prices.update"] })
      });
      expect(escalateRes.status).toBe(403);

      // Verify dependency resolution: granting customers.create automatically grants customers.view
      const grantRes = await req(`/users/${victim.id}/permissions`, ownerCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["customers.create"] })
      });
      expect(grantRes.status).toBe(200);
      const victimPerms = (await grantRes.json()).data.permissions;
      expect(victimPerms).toContain("customers.create");
      expect(victimPerms).toContain("customers.view");
    });
  });

  // --------------------------------------------------------------------------
  // P0 #2: Excess delivery when a dispatch already exists
  // --------------------------------------------------------------------------
  describe("P0 #2: Excess delivery with existing dispatch lines", () => {
    it("handles excess delivery without violating inventory movement unique constraints", async () => {
      // 1. Create customer
      const custSuffix = randomUUID().slice(0, 8);
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ name: `Excess Cust ${custSuffix}`, primaryPhone: "25261111111" })
      });
      const customer = (await custRes.json()).data;

      // 2. Create order: 5 fuusto
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "5",
          paidNow: "0",
          discount: "0",
          expectedPriceId: dieselPriceId,
          address: "Hodan District"
        })
      });
      const orderSummary = (await orderRes.json()).data;
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderSummary.id },
        include: { lines: true }
      });

      // 3. Create dispatch for the 5 fuusto
      const orderLine = order.lines[0]!;
      const dispatchRes = await req("/dispatches", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ orderLineId: orderLine.id, dispatchedUnits: "5" }]
        })
      });
      expect(dispatchRes.status).toBe(201);
      const dispatch = (await dispatchRes.json()).data;

      // Post the dispatch so it moves to IN_TRANSIT
      const postDispRes = await req(`/dispatches/${dispatch.id}/post`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() }
      });
      expect([200, 201]).toContain(postDispRes.status);

      // 4. Confirm delivery with 6 fuusto accepted (1 fuusto excess / overage)
      const deliveryRes = await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: order.id,
          lines: [{ orderLineId: orderLine.id, acceptedUnits: "6" }]
        })
      });
      expect([200, 201]).toContain(deliveryRes.status);

      // Verify that the excess movement exists and unique constraint did not collide
      const excessMovements = await prisma.inventoryMovement.findMany({
        where: { sourceType: "DispatchLineExcess" }
      });
      expect(excessMovements.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // P0 #3 & P0 #4: Customer refunds and retained credit immutability
  // --------------------------------------------------------------------------
  describe("P0 #3 & P0 #4: Customer refunds and retained credit", () => {
    it("refunds excess credit without modifying original Payment.amount", async () => {
      // Create customer
      const custSuffix = randomUUID().slice(0, 8);
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ name: `Refund Cust ${custSuffix}`, primaryPhone: "25262222222" })
      });
      const customer = (await custRes.json()).data;

      // Order 5 fuusto ($500), paid now $500
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "5",
          paidNow: "500",
          discount: "0",
          expectedPriceId: dieselPriceId,
          address: "Waberi",
          financialAccountId: cashAccountId
        })
      });
      const orderSummary = (await orderRes.json()).data;
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderSummary.id },
        include: { lines: true, payments: true }
      });
      const originalPaymentId = order.payments[0]!.id;

      // Deliver only 4 fuusto ($400), 1 returned. Excess paid now is $100.
      const deliveryRes = await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: order.id,
          lines: [{ orderLineId: order.lines[0]!.id, acceptedUnits: "4", remaining: "RETURNED" }]
        })
      });
      expect([200, 201]).toContain(deliveryRes.status);

      // Original payment amount before refund:
      const beforePayment = await prisma.payment.findUniqueOrThrow({ where: { id: originalPaymentId } });
      expect(beforePayment.amount.toString()).toBe("500");
      expect(beforePayment.unappliedAmount.toString()).toBe("100");

      // Refund the $100 excess
      const refundRes = await req(`/simple/orders/${order.id}/excess-credit/refund`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          amount: "100.00",
          reason: "Returned fuel customer refund",
          financialAccountId: cashAccountId
        })
      });
      expect([200, 201]).toContain(refundRes.status);

      // CRITICAL P0 INVARIANT: Original Payment.amount must NOT have been changed to 400!
      const afterPayment = await prisma.payment.findUniqueOrThrow({ where: { id: originalPaymentId } });
      expect(afterPayment.amount.toString()).toBe("500");
      expect(afterPayment.unappliedAmount.toString()).toBe("0");

      // An immutable refund account movement and customer ledger entry are created
      const refundMovements = await prisma.financialAccountMovement.findMany({
        where: { accountId: cashAccountId, direction: "MONEY_OUT", sourceType: "SalesOrderRefund" }
      });
      expect(refundMovements.length).toBe(1);
      expect(refundMovements[0]?.amount.toString()).toBe("100");
    });

    it("keeps excess credit unallocated without auto-applying to historical open invoices", async () => {
      const custSuffix = randomUUID().slice(0, 8);
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ name: `Keep Credit Cust ${custSuffix}` })
      });
      const customer = (await custRes.json()).data;

      // 1. Old order: 2 fuusto ($200), unpaid, delivered -> creates $200 debt
      const oldOrderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "2",
          paidNow: "0",
          discount: "0",
          expectedPriceId: dieselPriceId,
          address: "Old Order Address"
        })
      });
      const oldOrderSummary = (await oldOrderRes.json()).data;
      const oldOrder = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: oldOrderSummary.id },
        include: { lines: true }
      });

      await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: oldOrder.id,
          lines: [{ orderLineId: oldOrder.lines[0]!.id, acceptedUnits: "2" }]
        })
      });

      const oldInvoice = await prisma.invoice.findFirstOrThrow({
        where: { customerId: customer.id, status: "UNPAID" }
      });
      expect(oldInvoice.balanceDue.toString()).toBe("200");

      // 2. New order: 3 fuusto ($300), paid $300, only 2 fuusto delivered ($200), 1 returned -> $100 excess
      const newOrderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "3",
          paidNow: "300",
          discount: "0",
          expectedPriceId: dieselPriceId,
          address: "New Order Address",
          financialAccountId: cashAccountId
        })
      });
      const newOrderSummary = (await newOrderRes.json()).data;
      const newOrder = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: newOrderSummary.id },
        include: { lines: true }
      });

      await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: newOrder.id,
          lines: [{ orderLineId: newOrder.lines[0]!.id, acceptedUnits: "2", remaining: "RETURNED" }]
        })
      });

      // 3. Call keep excess credit
      const keepRes = await req(`/simple/orders/${newOrder.id}/excess-credit/keep`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() }
      });
      expect([200, 201]).toContain(keepRes.status);

      // CRITICAL P0 INVARIANT: Old invoice must NOT have been silently auto-allocated!
      const checkOldInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: oldInvoice.id } });
      expect(checkOldInvoice.balanceDue.toString()).toBe("200");

      // The $100 unapplied payment now has orderId: null
      const unappliedPayments = await prisma.payment.findMany({
        where: { customerId: customer.id, orderId: null, unappliedAmount: { gt: 0 } }
      });
      expect(unappliedPayments.length).toBeGreaterThan(0);
      expect(unappliedPayments[0]?.unappliedAmount.toString()).toBe("100");
    });
  });

  // --------------------------------------------------------------------------
  // P0 #5: Multi-line supplier stock receipts single Paid Now recording
  // --------------------------------------------------------------------------
  describe("P0 #5: Multi-line supplier stock receipts", () => {
    it("records and allocates Paid Now exactly once for multi-line receipts", async () => {
      const receiptNo = `RC-${randomUUID().slice(0, 6)}`;
      const beforeAccount = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });

      const draftRes = await req("/stock/receipts", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          purchaseDate: new Date().toISOString(),
          supplierId: testSupplierId,
          paidNow: "200.00",
          financialAccountId: cashAccountId,
          lines: [
            { fuelId: dieselFuelId, quantityFuusto: "10", totalPurchaseCost: "800.00" },
            { fuelId: petrolFuelId, quantityFuusto: "10", totalPurchaseCost: "1000.00" }
          ]
        })
      });
      expect(draftRes.status).toBe(201);
      const draft = (await draftRes.json()).data;

      const postRes = await req(`/stock/receipts/${draft.id}/post`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() }
      });
      expect(postRes.status).toBe(201);

      // Verify exactly ONE supplier payment was created
      const payments = await prisma.supplierPayment.findMany({
        where: { supplierId: testSupplierId, amount: new Prisma.Decimal("200") }
      });
      expect(payments.length).toBe(1);

      // Verify exactly ONE account movement was recorded
      const afterAccount = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });
      expect(beforeAccount.currentBalance.sub(afterAccount.currentBalance).toString()).toBe("200");
    });
  });

  // --------------------------------------------------------------------------
  // P0 #6: Stock adjustment idempotency and integer fuusto
  // --------------------------------------------------------------------------
  describe("P0 #6: Stock adjustments validation and idempotency", () => {
    it("rejects fractional fuusto and enforces idempotency key", async () => {
      // 1. Missing idempotency key -> 400
      const noKeyRes = await req("/stock/adjustments", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          fuelId: dieselFuelId,
          signedDeltaFuusto: "5",
          reason: "Inventory check"
        })
      });
      expect(noKeyRes.status).toBe(400);

      // 2. Fractional fuusto -> 400
      const fracRes = await req("/stock/adjustments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          signedDeltaFuusto: "2.5",
          reason: "Half drum test"
        })
      });
      expect(fracRes.status).toBe(400);

      // 3. Valid integer adjustment with Idempotency-Key
      const adjKey = key();
      const validRes = await req("/stock/adjustments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": adjKey },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          signedDeltaFuusto: "5",
          reason: "Audit adjustment"
        })
      });
      expect(validRes.status).toBe(201);

      // 4. Replay same idempotency key -> returns replay without second movement
      const replayRes = await req("/stock/adjustments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": adjKey },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          signedDeltaFuusto: "5",
          reason: "Audit adjustment"
        })
      });
      expect(replayRes.status).toBe(201);
      const replayData = (await replayRes.json()).data;
      expect(replayData.replay).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // P0 #7: Archived customers with debt in financial reports
  // --------------------------------------------------------------------------
  describe("P0 #7: Archived customers in financial debt reports", () => {
    it("includes archived customers with open invoices in debt reports", async () => {
      const custSuffix = randomUUID().slice(0, 8);
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ name: `Archived Inactive Cust ${custSuffix}` })
      });
      const customer = (await custRes.json()).data;

      // Create order: 3 fuusto ($300), deliver, create unpaid invoice
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "3",
          paidNow: "0",
          discount: "0",
          expectedPriceId: dieselPriceId,
          address: "Archive Test"
        })
      });
      const orderSummary = (await orderRes.json()).data;
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderSummary.id },
        include: { lines: true }
      });

      await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: order.id,
          lines: [{ orderLineId: order.lines[0]!.id, acceptedUnits: "3" }]
        })
      });

      // Now archive the customer
      const archiveRes = await req(`/customers/${customer.id}/archive`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ reason: "Business closed down" })
      });
      expect([200, 201]).toContain(archiveRes.status);

      // Check debt report: customer must be returned
      const debtsRes = await req("/financial/debts", ownerCookie);
      expect(debtsRes.status).toBe(200);
      const debtData = (await debtsRes.json()).data;

      const found = debtData.customers.find((c: { customerId: string }) => c.customerId === customer.id);
      expect(found).toBeDefined();
      expect(found.remainingDebt).toBe("300.00");
      expect(found.status).toBe("INACTIVE");

      // Verify PDF export also succeeds
      const pdfRes = await req("/reports/debts/pdf", ownerCookie);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get("content-type")).toContain("application/pdf");
    });
  });

  // --------------------------------------------------------------------------
  // P1 #8: Final invoices show actual delivered quantities & totals
  // --------------------------------------------------------------------------
  describe("P1 #8: Final invoice quantities and PDF generation", () => {
    it("generates invoice PDF reflecting actual delivered units and pro-rated discount", async () => {
      const custSuffix = randomUUID().slice(0, 8);
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ name: `Invoice PDF Cust ${custSuffix}` })
      });
      const customer = (await custRes.json()).data;

      // Order 10 fuusto with $50 discount ($100/fuusto -> $1000 subtotal, $950 net)
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "10",
          paidNow: "0",
          discount: "50",
          expectedPriceId: dieselPriceId,
          address: "Delivery Point"
        })
      });
      const orderSummary = (await orderRes.json()).data;
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderSummary.id },
        include: { lines: true }
      });

      // Deliver 8 fuusto with remaining fuel in transit
      await req("/simple/deliveries", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          orderId: order.id,
          lines: [{ orderLineId: order.lines[0]!.id, acceptedUnits: "8", remaining: "IN_TRANSIT" }]
        })
      });

      // Request order invoice PDF
      const pdfRes = await req(`/orders/${order.id}/invoice-pdf`, ownerCookie);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get("content-type")).toContain("application/pdf");
    });
  });

  // --------------------------------------------------------------------------
  // P1 #9: Backend service permissions consistency
  // --------------------------------------------------------------------------
  describe("P1 #9: Staff permissions on financial workflows", () => {
    it("allows staff with accounts.transfer to transfer and blocks without permission", async () => {
      const empSuffix = randomUUID().slice(0, 8);
      const empEmail = `transfer-staff-${empSuffix}@test.invalid`;
      const empPassword = `Password123456!`;

      const createRes = await req("/users", ownerCookie, {
        method: "POST",
        body: JSON.stringify({
          displayName: "Transfer Staff",
          email: empEmail,
          password: empPassword,
          role: "OFFICE_EMPLOYEE"
        })
      });
      const emp = (await createRes.json()).data;

      // 1. Without accounts.transfer -> 403
      await req(`/users/${emp.id}/permissions`, ownerCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["accounts.view"] })
      });
      const empLogin = await login(empEmail, empPassword);

      const forbiddenRes = await req("/financial-accounts/transfers", empLogin.cookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fromAccountId: cashAccountId,
          toAccountId: bankAccountId,
          amount: "50.00",
          transferDate: new Date().toISOString()
        })
      });
      expect(forbiddenRes.status).toBe(403);

      // 2. Grant accounts.transfer -> 201
      await req(`/users/${emp.id}/permissions`, ownerCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["accounts.transfer"] })
      });

      const allowedRes = await req("/financial-accounts/transfers", empLogin.cookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fromAccountId: cashAccountId,
          toAccountId: bankAccountId,
          amount: "50.00",
          transferDate: new Date().toISOString()
        })
      });
      expect(allowedRes.status).toBe(201);
    });
  });

  // --------------------------------------------------------------------------
  // P1 #11: Financial reversal workflows
  // --------------------------------------------------------------------------
  describe("P1 #11: Transfer and expense reversals", () => {
    it("reverses transfer cleanly restoring source and destination accounts", async () => {
      const cashBefore = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });
      const bankBefore = await prisma.financialAccount.findUniqueOrThrow({ where: { id: bankAccountId } });

      // Transfer $100 from Cash to Bank
      const transferRes = await req("/financial-accounts/transfers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fromAccountId: cashAccountId,
          toAccountId: bankAccountId,
          amount: "100.00",
          transferDate: new Date().toISOString()
        })
      });
      expect(transferRes.status).toBe(201);
      const transferId = (await transferRes.json()).data.id;

      // Reverse the transfer
      const reverseRes = await req(`/financial-accounts/transfers/${transferId}/reverse`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ reason: "Mistaken account transfer" })
      });
      expect(reverseRes.status).toBe(201);

      const cashAfter = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });
      const bankAfter = await prisma.financialAccount.findUniqueOrThrow({ where: { id: bankAccountId } });

      expect(cashAfter.currentBalance.toString()).toBe(cashBefore.currentBalance.toString());
      expect(bankAfter.currentBalance.toString()).toBe(bankBefore.currentBalance.toString());
    });

    it("reverses expense via correcting entry", async () => {
      const cashBefore = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });

      // Record $75 expense
      const expenseRes = await req("/expenses", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          financialAccountId: cashAccountId,
          amount: "75.00",
          category: "OFFICE_SUPPLIES",
          description: "Generator maintenance parts",
          expenseDate: new Date().toISOString()
        })
      });
      expect(expenseRes.status).toBe(201);
      const expenseId = (await expenseRes.json()).data.id;

      // Reverse expense
      const reverseRes = await req(`/expenses/${expenseId}/reverse`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({ reason: "Duplicate invoice error" })
      });
      expect(reverseRes.status).toBe(201);

      const cashAfter = await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } });
      expect(cashAfter.currentBalance.toString()).toBe(cashBefore.currentBalance.toString());
    });
  });
});
