import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";
import { CustomerAccountService } from "./customer-account.service.js";
import { AppController } from "./app.controller.js";
import type { Actor } from "./auth.js";
import { PERMISSION_CODES } from "@fuel/shared";

const db = new PrismaService();
const financial = new FinancialWorkflowsService(db);
const simple = new SimpleWorkflowsService(db, financial);
const customerAccounts = new CustomerAccountService(db);
const key = () => randomUUID();
let owner: Actor; let fuelId: string; let unitId: string; let priceId: string; let customerId: string; let supplierId: string; let accountId: string;

describe("V7.1 financial accounts, expenses, suppliers, and receipts", () => {
  beforeAll(async () => {
    const suffix = key();
    const user = await db.user.create({ data: { email: `v71-${suffix}@test.invalid`, displayName: "V7.1 Owner", role: "OWNER", passwordHash: "unused" } });
    owner = { id: user.id, email: user.email, displayName: user.displayName, role: "OWNER", permissions: [...PERMISSION_CODES] };
    const fuel = await db.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Basiin" } }); fuelId = fuel.id;
    const unit = await db.salesUnit.create({ data: { code: `V71_${suffix}`, name: "Fuusto" } }); unitId = unit.id;
    const since = new Date(Date.now() - 86400000);
    await db.fuelUnitVersion.create({ data: { fuelId, salesUnitId: unitId, litersPerUnit: new Prisma.Decimal(240), effectiveFromUtc: since, createdById: owner.id } });
    const price = await db.priceVersion.create({ data: { fuelId, salesUnitId: unitId, unitPrice: new Prisma.Decimal(100), effectiveFromUtc: since, createdById: owner.id } }); priceId = price.id;
    const customer = await db.customer.create({ data: { code: `V71C_${suffix}`, name: "V7.1 Customer", primaryPhone: "+252610000000", createdById: owner.id } }); customerId = customer.id;
    supplierId = (await financial.createSupplier(owner, { name: `V7.1 Supplier ${suffix}` })).id;
    accountId = (await financial.createAccount(owner, key(), { name: `Business Cash ${suffix}`, type: "CASH", identifierMasked: "**** 7100", openingBalance: "1000", openingBalanceAsOf: "2026-10-01", overdraftPolicy: "BLOCK_NEGATIVE", allowOfficePayments: true }) as { id: string }).id;
  });
  afterAll(async () => db.$disconnect());

  it("posts a $40 expense and one atomic Money Out movement", async () => {
    const result = await financial.createExpense(owner, key(), { description: "Delivery fuel", category: "Delivery", amount: "40", expenseDate: "2026-10-15", financialAccountId: accountId }) as { id: string };
    const account = await db.financialAccount.findUniqueOrThrow({ where: { id: accountId } });
    expect(account.currentBalance.toString()).toBe("960");
    expect(await db.financialAccountMovement.count({ where: { sourceType: "BusinessExpense", sourceId: result.id, kind: "EXPENSE" } })).toBe(1);
  });

  it("tracks a supplier purchase, Paid Now, and later FIFO supplier debt payment", async () => {
    const receipt = await simple.receipt(owner, key(), { fuelId, quantity: "5", date: "2026-10-15", totalCost: "500", supplierId, paidNow: "100", financialAccountId: accountId }) as { id: string };
    const purchase = await db.supplierPurchase.findFirstOrThrow({ where: { receiptId: receipt.id } });
    expect(purchase.balanceDue.toString()).toBe("400");
    await financial.supplierPayment(owner, key(), supplierId, { financialAccountId: accountId, amount: "150", paymentDate: "2026-10-15" });
    const updated = await db.supplierPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(updated.paidAmount.toString()).toBe("250");
    expect(updated.balanceDue.toString()).toBe("250");
  });

  it("records one customer Money In, generates receipts without side effects, and reverses once", async () => {
    const orderResult = await simple.order(owner, key(), { customerId, fuelId, salesUnitId: unitId, quantity: "2", expectedPriceId: priceId, address: "Wadajir", discount: "0", paidNow: "0" }) as { id: string };
    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderResult.id }, include: { lines: true } });
    await simple.delivery(owner, key(), { orderId: order.id, lines: [{ orderLineId: order.lines[0]!.id, acceptedUnits: "2" }] });
    const payment = await simple.payment(owner, key(), { customerId, amount: "200", financialAccountId: accountId, method: "CASH" }) as { id: string };
    expect(await db.financialAccountMovement.count({ where: { sourceType: "Payment", sourceId: payment.id, kind: "CUSTOMER_PAYMENT" } })).toBe(1);

    const before = await db.financialAccountMovement.count();
    const controller = new AppController(db, customerAccounts, simple);
    const buffers: Buffer[] = [];
    const response = { setHeader: () => response, send: (value: Buffer) => { buffers.push(value); return response; } };
    await controller.paymentReceiptPdf({ actor: owner } as any, payment.id, response as never);
    await controller.paymentReceiptPdf({ actor: owner } as any, payment.id, response as never);
    expect(buffers).toHaveLength(2);
    expect(buffers.every((buffer) => buffer.subarray(0, 4).toString() === "%PDF")).toBe(true);
    expect(await db.financialAccountMovement.count()).toBe(before);

    const reversals = await Promise.all([simple.reversePayment(owner, key(), payment.id, "Customer correction"), simple.reversePayment(owner, key(), payment.id, "Customer correction")]);
    expect(reversals.every((row) => (row as { status: string }).status === "REVERSED")).toBe(true);
    expect(await db.paymentReversal.count({ where: { paymentId: payment.id } })).toBe(1);
    expect(await db.financialAccountMovement.count({ where: { accountId, kind: "CUSTOMER_PAYMENT_REVERSAL", sourceType: "PaymentReversal" } })).toBe(1);
  });
});
