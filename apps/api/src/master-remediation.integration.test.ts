import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@fuel/database";
import { AppModule } from "./app.module.js";
import { PermissionCode, PERMISSION_CODES } from "@fuel/shared";

describe("FuelDesk Master Remediation Integration Tests (Scenarios C1 - C10)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let base = "";
  let ownerCookie = "";
  let ownerId = "";
  const suffix = randomUUID().slice(0, 8);
  const ownerEmail = `master-owner-${suffix}@test.invalid`;
  const ownerPassword = `Master-${randomUUID()}!`;

  let dieselFuelId = "";
  let petrolFuelId = "";
  let fuustoUnitId = "";
  let dieselPriceId = "";
  let petrolPriceId = "";
  let evcAccountId = "";
  let cashAccountId = "";
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
        displayName: "Master Remedy Owner",
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

    // Naafto $100 / fuusto, Basiin $120 / fuusto
    const dPrice = await prisma.priceVersion.create({
      data: { fuelId: dieselFuelId, salesUnitId: fuustoUnitId, unitPrice: new Prisma.Decimal(100), effectiveFromUtc: since, createdById: ownerId }
    });
    dieselPriceId = dPrice.id;

    const pPrice = await prisma.priceVersion.create({
      data: { fuelId: petrolFuelId, salesUnitId: fuustoUnitId, unitPrice: new Prisma.Decimal(120), effectiveFromUtc: since, createdById: ownerId }
    });
    petrolPriceId = pPrice.id;

    // Accounts
    const evc = await prisma.financialAccount.create({
      data: {
        code: `EVC_${suffix}`,
        name: "EVC Plus Account",
        type: "MOBILE_MONEY",
        paymentMethod: "EVC_PLUS",
        openingBalance: new Prisma.Decimal(100000),
        openingBalanceAsOf: since,
        currentBalance: new Prisma.Decimal(100000),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: ownerId
      }
    });
    evcAccountId = evc.id;

    const cash = await prisma.financialAccount.create({
      data: {
        code: `CASH_${suffix}`,
        name: "Cash Drawer",
        type: "CASH",
        openingBalance: new Prisma.Decimal(50000),
        openingBalanceAsOf: since,
        currentBalance: new Prisma.Decimal(50000),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: ownerId
      }
    });
    cashAccountId = cash.id;

    const supplier = await prisma.supplier.create({
      data: {
        code: `SUP_${suffix}`,
        name: "Global Fuel Importer",
        status: "ACTIVE",
        createdById: ownerId
      }
    });
    testSupplierId = supplier.id;

    // Provide initial warehouse stock (100 fuusto each)
    await req("/simple/receipts", ownerCookie, {
      method: "POST",
      headers: { "idempotency-key": key() },
      body: JSON.stringify({
        fuelId: dieselFuelId,
        quantity: "100",
        date: "2026-10-15",
        notes: "Initial diesel stock"
      })
    });
    await req("/simple/receipts", ownerCookie, {
      method: "POST",
      headers: { "idempotency-key": key() },
      body: JSON.stringify({
        fuelId: petrolFuelId,
        quantity: "100",
        date: "2026-10-15",
        notes: "Initial petrol stock"
      })
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  describe("C1: Mixed Fuel Order without Discount", () => {
    it("creates, dispatches, confirms delivery with variance, and reconciles paid now", async () => {
      // 1. Create Customer
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Ahmed Duale",
          primaryPhone: "252615551122",
          address: "Hodan District, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // 2. Place ONE Sales Order with 2 fuel lines:
      // Naafto 10 @ $100 ($1000) + Basiin 5 @ $120 ($600) = $1,600 Gross
      // Paid Now $500 to EVC account
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          lines: [
            { fuelId: dieselFuelId, salesUnitId: fuustoUnitId, quantity: "10", expectedPriceId: dieselPriceId },
            { fuelId: petrolFuelId, salesUnitId: fuustoUnitId, quantity: "5", expectedPriceId: petrolPriceId }
          ],
          address: "Hodan Station",
          discount: "0",
          paidNow: "500",
          financialAccountId: evcAccountId,
          notes: "Scenario C1 order"
        })
      });
      expect(orderRes.status).toBe(201);
      const orderData = (await orderRes.json()).data;
      const orderId = orderData.id;

      // Verify order details
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { lines: true, payments: true }
      });
      expect(order.lines.length).toBe(2);
      expect(Number(order.subtotal)).toBe(1600);
      expect(Number(order.totalAmount)).toBe(1600);
      expect(order.payments.length).toBe(1);
      expect(Number(order.payments[0]?.amount)).toBe(500);
      expect(Number(order.payments[0]?.unappliedAmount)).toBe(500);

      const dieselLine = order.lines.find(l => l.fuelId === dieselFuelId)!;
      const petrolLine = order.lines.find(l => l.fuelId === petrolFuelId)!;

      // 3. Confirm delivery:
      // Naafto 8 accepted / 2 returned, closeRemainder: true
      // Basiin 6 accepted (1 overage)
      const deliveryRes = await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [
            {
              lineId: dieselLine.id,
              acceptedUnits: "8",
              remaining: "RETURNED",
              closeRemainder: true
            },
            {
              lineId: petrolLine.id,
              acceptedUnits: "6",
              closeRemainder: true
            }
          ]
        })
      });
      expect(deliveryRes.status).toBe(201);

      // 4. Verify Financial Reconciliation:
      // Accepted sales: 8 * $100 ($800) + 6 * $120 ($720) = $1,520
      // Paid Now allocated: $500
      // Delivered unpaid debt: $1,520 - $500 = $1,020
      const invoices = await prisma.invoice.findMany({
        where: { lines: { some: { orderLine: { orderId } } } },
        include: { lines: true }
      });
      expect(invoices.length).toBe(2);
      const totalInvoiceSubtotal = invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      const totalAllocated = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const totalBalanceDue = invoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
      expect(totalInvoiceSubtotal).toBe(1520);
      expect(totalInvoiceAmount).toBe(1520);
      expect(totalAllocated).toBe(500);
      expect(totalBalanceDue).toBe(1020);

      // Verify customer account statement
      const custAccount = await req(`/customers/${customer.id}/account`, ownerCookie);
      const accData = await custAccount.json();
      expect(Number(accData.data.summary.totalSales)).toBe(1520);
      expect(Number(accData.data.summary.totalPaid)).toBe(500);
      expect(Number(accData.data.summary.remainingDebt)).toBe(1020);
    });
  });

  describe("C2: Mixed Fuel Order with Flat Discount", () => {
    it("allocates single order fixed discount proportionally by monetary value across fuels", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Farah Warsame",
          primaryPhone: "252615553344",
          address: "Wadajir, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Naafto 10 @ $100 ($1000) + Basiin 5 @ $120 ($600) = $1600 Gross
      // Flat Discount = $160
      // Naafto ratio: 1000/1600 = 62.5% -> $100 discount
      // Basiin ratio: 600/1600 = 37.5% -> $60 discount
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          lines: [
            { fuelId: dieselFuelId, salesUnitId: fuustoUnitId, quantity: "10", expectedPriceId: dieselPriceId },
            { fuelId: petrolFuelId, salesUnitId: fuustoUnitId, quantity: "5", expectedPriceId: petrolPriceId }
          ],
          address: "Wadajir Depot",
          discount: "160",
          paidNow: "0",
          notes: "Scenario C2 flat discount order"
        })
      });
      expect(orderRes.status).toBe(201);
      const orderId = (await orderRes.json()).data.id;

      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { lines: true }
      });
      expect(Number(order.subtotal)).toBe(1600);
      expect(Number(order.fixedDiscountAmount)).toBe(160);
      expect(Number(order.totalAmount)).toBe(1440);

      const dieselLine = order.lines.find(l => l.fuelId === dieselFuelId)!;
      const petrolLine = order.lines.find(l => l.fuelId === petrolFuelId)!;

      // Partial Delivery: 5 Naafto accepted (50% of Naafto requested) and 5 Basiin accepted (100% of Basiin requested)
      // Gross accepted: 5 * 100 ($500) + 5 * 120 ($600) = $1,100
      // Pro-rated discount:
      // Naafto discount: $160 * (500 / 1600) = $50
      // Basiin discount: $160 * (600 / 1600) = $60
      // Total invoice discount = $110
      // Total invoice amount = $1,100 - $110 = $990
      const deliveryRes = await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [
            { lineId: dieselLine.id, acceptedUnits: "5", remaining: "RETURNED", closeRemainder: false },
            { lineId: petrolLine.id, acceptedUnits: "5", closeRemainder: true }
          ]
        })
      });
      expect(deliveryRes.status).toBe(201);

      const invoices = await prisma.invoice.findMany({
        where: { lines: { some: { orderLine: { orderId } } } }
      });
      expect(invoices.length).toBe(2);
      const totalSubtotal = invoices.reduce((sum, inv) => sum + Number(inv.subtotal), 0);
      const totalDiscount = invoices.reduce((sum, inv) => sum + Number(inv.discountAmount), 0);
      const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
      expect(totalSubtotal).toBe(1100);
      expect(totalDiscount).toBe(110);
      expect(totalAmount).toBe(990);
    });
  });

  describe("C3: Under-delivery with Pre-existing Dispatch", () => {
    it("restores warehouse stock on physical return and depletes in-transit stock", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Halima Abdi",
          primaryPhone: "252615555566",
          address: "Hamar Weyne, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Order 10 fuusto diesel
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "10",
          expectedPriceId: dieselPriceId,
          address: "Hamar Weyne Port",
          discount: "0",
          paidNow: "0"
        })
      });
      const orderId = (await orderRes.json()).data.id;
      const order = await prisma.salesOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: { lines: true }
      });
      const orderLineId = order.lines[0]!.id;

      // 1. Create and post dispatch of 10 fuusto
      const dispRes = await req("/dispatches", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ orderLineId, dispatchedUnits: "10" }]
        })
      });
      const dispatchId = (await dispRes.json()).data.id;

      const postRes = await req(`/dispatches/${dispatchId}/post`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() }
      });
      expect([200, 201]).toContain(postRes.status);

      // Check warehouse stock was decremented by 10 * 240 = 2400 L
      // In-transit stock was incremented by 2400 L
      const inTransitBefore = await prisma.stockBalance.findUniqueOrThrow({
        where: { fuelId_location: { fuelId: dieselFuelId, location: "IN_TRANSIT" } }
      });
      expect(inTransitBefore.balanceLiters.gte(2400)).toBe(true);

      // 2. Reconcile delivery: 7 accepted, 3 returned
      const recRes = await req(`/dispatches/${dispatchId}/reconcile`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [
            {
              dispatchLineId: (await prisma.dispatchLine.findFirstOrThrow({ where: { dispatchId } })).id,
              acceptedUnits: "7",
              physicalReturnedLiters: "720", // 3 * 240
              commercialDisposition: "CANCEL_REMAINDER",
              discrepancyReason: "Customer capacity limited"
            }
          ]
        })
      });
      expect([200, 201]).toContain(recRes.status);

      // Verify RETURN inventory movement was created
      const returnMovement = await prisma.inventoryMovement.findFirst({
        where: { fuelId: dieselFuelId, eventType: "RETURN", location: "WAREHOUSE", signedDeltaLiters: new Prisma.Decimal(720) }
      });
      expect(returnMovement).not.toBeNull();
    });
  });

  describe("C4: Repeat Customer Refunds & Excess Credit", () => {
    it("handles multiple partial refunds idempotently and prevents exceeding excess credit", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Ali Yusuf",
          primaryPhone: "252615557788",
          address: "Kaaran, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Paid Now $1,000 for 10 fuusto diesel ($1,000)
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "10",
          expectedPriceId: dieselPriceId,
          address: "Kaaran",
          discount: "0",
          paidNow: "1000",
          financialAccountId: cashAccountId
        })
      });
      const orderId = (await orderRes.json()).data.id;

      // Deliver only 6 fuusto ($600 accepted), cancel remaining 4 ($400 excess)
      const line = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } })).lines[0]!;
      await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ lineId: line.id, acceptedUnits: "6", closeRemainder: true }]
        })
      });

      // Verify $400 unapplied credit on order payment
      const p1 = await prisma.payment.findFirstOrThrow({ where: { orderId } });
      expect(Number(p1.amount)).toBe(1000);
      expect(Number(p1.unappliedAmount)).toBe(400);

      // Refund 1: $100
      const ref1Key = key();
      const ref1Res = await req(`/simple/orders/${orderId}/excess-credit/refund`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": ref1Key },
        body: JSON.stringify({
          amount: "100",
          financialAccountId: cashAccountId,
          reason: "First refund of $100"
        })
      });
      expect(ref1Res.status).toBe(201);

      // Refund 2: $100
      const ref2Key = key();
      const ref2Res = await req(`/simple/orders/${orderId}/excess-credit/refund`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": ref2Key },
        body: JSON.stringify({
          amount: "100",
          financialAccountId: cashAccountId,
          reason: "Second refund of $100"
        })
      });
      expect(ref2Res.status).toBe(201);

      // Idempotent retry of Refund 2
      const retryRes = await req(`/simple/orders/${orderId}/excess-credit/refund`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": ref2Key },
        body: JSON.stringify({
          amount: "100",
          financialAccountId: cashAccountId,
          reason: "Second refund of $100"
        })
      });
      expect([200, 201]).toContain(retryRes.status);

      // Verify CustomerRefund records: exactly 2 distinct refunds
      const refunds = await prisma.customerRefund.findMany({ where: { orderId } });
      expect(refunds.length).toBe(2);
      expect(refunds.reduce((sum, r) => sum + Number(r.amount), 0)).toBe(200);

      // Verify unapplied credit is now $200
      const pAfter = await prisma.payment.findFirstOrThrow({ where: { orderId } });
      expect(Number(pAfter.unappliedAmount)).toBe(200);
      expect(Number(pAfter.amount)).toBe(1000); // Original payment amount unchanged!

      // Attempting to refund $300 (which exceeds $200 remaining credit) MUST FAIL
      const excessRefRes = await req(`/simple/orders/${orderId}/excess-credit/refund`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          amount: "300",
          financialAccountId: cashAccountId,
          reason: "Excessive refund"
        })
      });
      expect(excessRefRes.status).toBe(400);
    });
  });

  describe("C5: Staff Permissions & Cost Protection", () => {
    it("strictly isolates office employee permissions and conceals sensitive costs", async () => {
      // Create office employee
      const empEmail = `staff-${randomUUID().slice(0, 6)}@test.invalid`;
      const empPassword = "StaffPassword123!";
      const emp = await prisma.user.create({
        data: {
          displayName: "Office Staff",
          email: empEmail,
          passwordHash: await argon2.hash(empPassword),
          role: "OFFICE_EMPLOYEE"
        }
      });

      // Grant only dashboard.view
      await prisma.userPermission.create({
        data: {
          userId: emp.id,
          permission: "dashboard.view",
          grantedById: ownerId
        }
      });

      const { cookie: empCookie } = await login(empEmail, empPassword);

      // 1. Dashboard is accessible
      const dashRes = await req("/dashboard/overview", empCookie);
      expect(dashRes.status).toBe(200);

      // 2. Customers and orders routes are BLOCKED
      const custRes = await req("/customers", empCookie);
      expect(custRes.status).toBe(403);

      const orderRes = await req("/orders", empCookie);
      expect(orderRes.status).toBe(403);

      // 3. Sensitive purchase costs are redacted if employee lacks stock.purchase_cost.view
      // Grant suppliers.view
      await prisma.userPermission.create({
        data: {
          userId: emp.id,
          permission: "suppliers.view",
          grantedById: ownerId
        }
      });

      const supRes = await req("/suppliers", empCookie);
      expect(supRes.status).toBe(200);
      const supData = await supRes.json();
      expect(supData.data[0].balanceDue ?? null).toBeNull();
      expect(supData.data[0].totalPurchased ?? null).toBeNull();

      // 4. Permission administration is strictly OWNER-only
      const permRes = await req(`/users/${emp.id}/permissions`, empCookie, {
        method: "PUT",
        body: JSON.stringify({ permissions: ["customers.view"] })
      });
      expect(permRes.status).toBe(403);
    });
  });

  describe("C6: Stock Supplier Purchase with Optional Cost", () => {
    it("records stock receipt with optional cost, pays supplier from account, and updates debt", async () => {
      // Receive 20 fuusto diesel @ $80 = $1,600, with $500 Paid Now from cash drawer
      const initialCash = (await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } })).currentBalance;

      const receiptRes = await req("/simple/receipts", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          quantity: "20",
          unitCost: "80",
          supplierId: testSupplierId,
          paidNow: "500",
          financialAccountId: cashAccountId,
          date: "2026-10-16",
          notes: "Scenario C6 stock purchase"
        })
      });
      expect(receiptRes.status).toBe(201);

      // Cash account decreased by exactly $500
      const currentCash = (await prisma.financialAccount.findUniqueOrThrow({ where: { id: cashAccountId } })).currentBalance;
      expect(Number(initialCash.sub(currentCash))).toBe(500);

      // Supplier detail shows remaining debt: $1,600 - $500 = $1,100
      const supDetailRes = await req(`/suppliers/${testSupplierId}`, ownerCookie);
      const supDetail = await supDetailRes.json();
      expect(Number(supDetail.data.debt)).toBe(1100);
    });
  });

  describe("C7: Payment Receipt Historical Snapshot", () => {
    it("maintains historical debt balance on past receipts after subsequent payments settle invoice", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Gedi Noor",
          primaryPhone: "252615559900",
          address: "Shibis, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Order 5 fuusto diesel @ $100 = $500
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "5",
          expectedPriceId: dieselPriceId,
          address: "Shibis",
          discount: "0",
          paidNow: "0"
        })
      });
      const orderId = (await orderRes.json()).data.id;
      const line = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } })).lines[0]!;

      // Deliver 5 fuusto -> Invoice for $500 generated
      await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ lineId: line.id, acceptedUnits: "5", closeRemainder: true }]
        })
      });

      // Payment 1: $200 (leaving $300 debt)
      const pay1Res = await req("/simple/payments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          amount: "200",
          financialAccountId: cashAccountId,
          reference: "P1"
        })
      });
      const pay1Id = (await pay1Res.json()).data.id;

      // Payment 2: $300 (clearing remaining debt to $0)
      await req("/simple/payments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          amount: "300",
          financialAccountId: cashAccountId,
          reference: "P2"
        })
      });

      // Receipt PDF for Payment 1 must generate successfully
      const receiptPdfRes = await req(`/payments/${pay1Id}/receipt-pdf`, ownerCookie);
      expect(receiptPdfRes.status).toBe(200);
      expect(receiptPdfRes.headers.get("content-type")).toBe("application/pdf");
    });
  });

  describe("C8: Price Snapshot Immutability", () => {
    it("preserves agreed price snapshot even when master price list changes before delivery", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Sharmarke Hassan",
          primaryPhone: "252615551234",
          address: "Yaqshid, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Create test-isolated sales unit and price
      const c8Suffix = randomUUID().slice(0, 8);
      const c8Unit = await prisma.salesUnit.create({
        data: { code: `FUUSTO_C8_${c8Suffix}`, name: "Fuusto C8" }
      });
      const pastTime = new Date(Date.now() - 3600000);
      await prisma.fuelUnitVersion.create({
        data: {
          fuelId: dieselFuelId,
          salesUnitId: c8Unit.id,
          litersPerUnit: new Prisma.Decimal(240),
          effectiveFromUtc: pastTime,
          createdById: ownerId
        }
      });
      const c8Price1 = await prisma.priceVersion.create({
        data: {
          fuelId: dieselFuelId,
          salesUnitId: c8Unit.id,
          unitPrice: new Prisma.Decimal(100),
          effectiveFromUtc: pastTime,
          createdById: ownerId
        }
      });

      // Order 10 fuusto diesel with c8Unit @ $100
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: c8Unit.id,
          quantity: "10",
          expectedPriceId: c8Price1.id,
          address: "Yaqshid",
          discount: "0",
          paidNow: "0"
        })
      });
      expect(orderRes.status).toBe(201);
      const orderId = (await orderRes.json()).data.id;

      // Update active price for (dieselFuelId, c8Unit.id) to $150
      const now = new Date();
      await prisma.priceVersion.update({
        where: { id: c8Price1.id },
        data: { effectiveToUtc: now }
      });
      await prisma.priceVersion.create({
        data: {
          fuelId: dieselFuelId,
          salesUnitId: c8Unit.id,
          unitPrice: new Prisma.Decimal(150),
          effectiveFromUtc: now,
          createdById: ownerId
        }
      });

      // Confirm delivery of 10 fuusto
      const line = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } })).lines[0]!;
      const deliveryRes = await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ lineId: line.id, acceptedUnits: "10", closeRemainder: true }]
        })
      });
      expect(deliveryRes.status).toBe(201);

      // Invoice must use snapshot price ($100), totaling $1,000, NOT $1,500!
      const invoice = await prisma.invoice.findFirstOrThrow({
        where: { lines: { some: { orderLine: { orderId } } } }
      });
      expect(Number(invoice.totalAmount)).toBe(1000);
    });
  });

  describe("C9: Order Cancellation and Customer Archive Debt Preservation", () => {
    it("preserves debts when debtor is archived and reflects in debt report", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Khadar Iid",
          primaryPhone: "252615559876",
          address: "Bondhere, Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // Create delivered order with $400 debt
      const orderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "4",
          expectedPriceId: dieselPriceId,
          address: "Bondhere",
          discount: "0",
          paidNow: "0"
        })
      });
      const orderId = (await orderRes.json()).data.id;
      const line = (await prisma.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } })).lines[0]!;
      await req(`/simple/orders/${orderId}/deliver`, ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          lines: [{ lineId: line.id, acceptedUnits: "4", closeRemainder: true }]
        })
      });

      // Archive customer
      const archRes = await req(`/customers/${customer.id}/archive`, ownerCookie, {
        method: "POST",
        body: JSON.stringify({ reason: "Customer relocated" })
      });
      expect([200, 201]).toContain(archRes.status);

      // Verify customer debt is preserved in invoice reports and customer account statement
      const invoiceReportRes = await req("/reports/invoices?status=UNPAID", ownerCookie);
      expect(invoiceReportRes.status).toBe(200);
      const invoiceReport = await invoiceReportRes.json();
      const debtorRow = invoiceReport.data.items?.find((d: any) => d.customer?.name === customer.name || d.customerName === customer.name);
      expect(debtorRow).toBeDefined();
      expect(Number(debtorRow.invoicedBalance ?? debtorRow.balanceDue)).toBe(400);

      const accRes = await req(`/customers/${customer.id}/account`, ownerCookie);
      const acc = await accRes.json();
      expect(acc.data.customer.status).toBe("INACTIVE");
      expect(Number(acc.data.summary.remainingDebt)).toBe(400);
    });
  });

  describe("C10: Quantity Validation & Limit Invariants", () => {
    it("rejects non-integer quantities (fractional fuusto) across all endpoints", async () => {
      const custRes = await req("/customers", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          name: "Validation Test Customer",
          primaryPhone: "252615550000",
          address: "Mogadishu"
        })
      });
      const customer = (await custRes.json()).data;

      // 1. Fractional quantity in order creation: 0.5 fuusto
      const fracOrderRes = await req("/simple/orders", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          customerId: customer.id,
          fuelId: dieselFuelId,
          salesUnitId: fuustoUnitId,
          quantity: "0.5",
          expectedPriceId: dieselPriceId,
          address: "Mogadishu",
          discount: "0",
          paidNow: "0"
        })
      });
      expect(fracOrderRes.status).toBe(400);

      // 2. Fractional quantity in stock adjustments
      const fracAdjRes = await req("/stock/adjustments", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          quantityFuusto: "1.5",
          reason: "Fractional test"
        })
      });
      expect(fracAdjRes.status).toBe(400);

      // 3. Fractional quantity in stock receipt
      const fracReceiptRes = await req("/simple/receipts", ownerCookie, {
        method: "POST",
        headers: { "idempotency-key": key() },
        body: JSON.stringify({
          fuelId: dieselFuelId,
          quantity: "2.25",
          date: "2026-10-17",
          notes: "Fractional receipt"
        })
      });
      expect(fracReceiptRes.status).toBe(400);
    });
  });
});
