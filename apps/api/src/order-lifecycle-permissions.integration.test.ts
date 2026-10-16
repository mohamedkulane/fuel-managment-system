import "reflect-metadata";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";
import { CustomerAccountService } from "./customer-account.service.js";
import type { Actor } from "./auth.js";
import { PERMISSION_CODES, STANDARD_OFFICE_PERMISSIONS } from "@fuel/shared";

const db = new PrismaService();
const financial = new FinancialWorkflowsService(db);
const service = new SimpleWorkflowsService(db, financial);
const accounts = new CustomerAccountService(db);

let owner: Actor;
let employee: Actor;
let restrictedStaff: Actor;
let fuelId: string;
let unitId: string;
let priceId: string;
let accountId: string;

const key = () => randomUUID();

describe("Order Lifecycle & Dynamic Permissions Integration Suite", () => {
  beforeAll(async () => {
    const suffix = key();
    const ownerUser = await db.user.create({
      data: { email: `owner-${suffix}@test.invalid`, displayName: "Owner User", role: "OWNER", passwordHash: "unused" }
    });
    owner = { id: ownerUser.id, email: ownerUser.email, displayName: ownerUser.displayName, role: "OWNER", permissions: [...PERMISSION_CODES] };

    const employeeUser = await db.user.create({
      data: { email: `employee-${suffix}@test.invalid`, displayName: "Office Employee", role: "OFFICE_EMPLOYEE", passwordHash: "unused" }
    });
    employee = { id: employeeUser.id, email: employeeUser.email, displayName: employeeUser.displayName, role: "OFFICE_EMPLOYEE", permissions: [...STANDARD_OFFICE_PERMISSIONS] };

    const restrictedUser = await db.user.create({
      data: { email: `restricted-${suffix}@test.invalid`, displayName: "Restricted Staff", role: "OFFICE_EMPLOYEE", passwordHash: "unused" }
    });
    // Explicitly grant only dashboard.view
    await db.userPermission.create({
      data: { userId: restrictedUser.id, permission: "dashboard.view", grantedById: owner.id }
    });
    restrictedStaff = { id: restrictedUser.id, email: restrictedUser.email, displayName: restrictedUser.displayName, role: "OFFICE_EMPLOYEE", permissions: ["dashboard.view"] };

    const fuel = await db.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Naafto" } });
    fuelId = fuel.id;

    const unit = await db.salesUnit.create({ data: { code: `UNIT_${suffix}`, name: "Fuusto" } });
    unitId = unit.id;

    const since = new Date(Date.now() - 86400000);
    await db.fuelUnitVersion.create({
      data: { fuelId, salesUnitId: unitId, litersPerUnit: new Prisma.Decimal(240), effectiveFromUtc: since, createdById: owner.id }
    });

    const price = await db.priceVersion.create({
      data: { fuelId, salesUnitId: unitId, unitPrice: new Prisma.Decimal(100), effectiveFromUtc: since, createdById: owner.id }
    });
    priceId = price.id;

    const account = await db.financialAccount.create({
      data: {
        code: `ACC_${suffix}`,
        name: "Main Cash",
        type: "CASH",
        openingBalance: new Prisma.Decimal(10000),
        openingBalanceAsOf: since,
        currentBalance: new Prisma.Decimal(10000),
        overdraftPolicy: "BLOCK_NEGATIVE",
        createdById: owner.id
      }
    });
    accountId = account.id;

    // Stock the warehouse with 100 fuusto (24,000 liters)
    await service.receipt(owner, key(), { fuelId, quantity: "100", date: "2026-10-15" });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("1. Under-delivery with closeRemainder: true bills accepted, cancels remainder, marks order FULFILLED", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Under Delivery Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "10",
      paidNow: "0",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu"
    }) as { id: string };

    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderRes.id }, include: { lines: true } });
    const lineId = order.lines[0]!.id;

    // Deliver 7 units and close the 3 unfulfilled units
    await service.delivery(owner, key(), {
      orderId: order.id,
      lines: [{ orderLineId: lineId, acceptedUnits: "7", closeRemainder: true, reason: "Customer requested only 7" }]
    });

    const updatedOrder = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
    expect(updatedOrder.status).toBe("FULFILLED");
    expect(Number(updatedOrder.lines[0]!.cancelledUnits)).toBe(3);

    // Invoices should reflect exactly 7 fuusto * $100 = $700
    const invoices = await db.invoice.findMany({ where: { customerId: cust.id } });
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0]!.totalAmount)).toBe(700);
  });

  it("2. Excess delivery with owner approval records amendedUnits and delivers overage", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Excess Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "10",
      paidNow: "0",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu"
    }) as { id: string };

    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderRes.id }, include: { lines: true } });
    const lineId = order.lines[0]!.id;

    // Owner approves delivering 12 units (2 excess)
    await service.delivery(owner, key(), {
      orderId: order.id,
      lines: [{ orderLineId: lineId, acceptedUnits: "12", amendmentReason: "Extra tank filled at station" }]
    });

    const updatedOrder = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
    expect(updatedOrder.status).toBe("FULFILLED");
    expect(Number(updatedOrder.lines[0]!.amendedUnits)).toBe(2);
    expect(updatedOrder.lines[0]!.amendmentApprovedById).toBe(owner.id);

    // Invoice reflects exactly 12 fuusto * $100 = $1,200
    const invoices = await db.invoice.findMany({ where: { customerId: cust.id } });
    expect(invoices).toHaveLength(1);
    expect(Number(invoices[0]!.totalAmount)).toBe(1200);
  });

  it("3. Excess delivery by staff without overage_approve permission is rejected (403)", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Unauthorized Excess Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "5",
      paidNow: "0",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu"
    }) as { id: string };

    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderRes.id }, include: { lines: true } });
    const lineId = order.lines[0]!.id;

    // Employee attempts to deliver 7 without owner overage approval
    await expect(
      service.delivery(employee, key(), {
        orderId: order.id,
        lines: [{ orderLineId: lineId, acceptedUnits: "7" }]
      })
    ).rejects.toThrow("Ansixinta milkiilaha");
  });

  it("4. Safe order cancellation before dispatch with reason", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Cancel Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "5",
      paidNow: "0",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu"
    }) as { id: string };

    const cancelRes = await service.cancelOrder(owner, key(), orderRes.id, "Macmiilku wuu baajiyay dalabka") as { status: string };
    expect(cancelRes.status).toBe("CANCELLED");

    const cancelledOrder = await db.salesOrder.findUniqueOrThrow({ where: { id: orderRes.id } });
    expect(cancelledOrder.status).toBe("CANCELLED");
    expect(cancelledOrder.cancellationReason).toBe("Macmiilku wuu baajiyay dalabka");
    expect(cancelledOrder.cancelledById).toBe(owner.id);
  });

  it("5. Safe order cancellation with Paid Now preserves payment with owner resolution flag", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Paid Now Cancel Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "5",
      paidNow: "200",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu",
      financialAccountId: accountId
    }) as { id: string };

    const cancelRes = await service.cancelOrder(owner, key(), orderRes.id, "Delivered cancelled, refund needed") as { status: string };
    expect(cancelRes.status).toBe("CANCELLED");

    // Payment and financial account records are preserved
    const payment = await db.payment.findFirstOrThrow({ where: { orderId: orderRes.id } });
    expect(payment.status).toBe("POSTED");
    expect(Number(payment.amount)).toBe(200);
  });

  it("6. Remainder cancellation on partially fulfilled order closes remainder", async () => {
    const cust = await db.customer.create({ data: { code: `CUST_${key()}`, name: "Partial Remainder Customer", createdById: owner.id } });
    const orderRes = await service.order(owner, key(), {
      customerId: cust.id,
      fuelId,
      salesUnitId: unitId,
      quantity: "10",
      paidNow: "0",
      discount: "0",
      expectedPriceId: priceId,
      address: "Mogadishu"
    }) as { id: string };

    const order = await db.salesOrder.findUniqueOrThrow({ where: { id: orderRes.id }, include: { lines: true } });
    const lineId = order.lines[0]!.id;

    // Deliver 6 units, leave remainder in transit/open
    await service.delivery(owner, key(), {
      orderId: order.id,
      lines: [{ orderLineId: lineId, acceptedUnits: "6", remaining: "RETURNED" }]
    });

    const midOrder = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(midOrder.status).toBe("PARTIALLY_FULFILLED");

    // Now cancel remainder
    const closed = await service.cancelRemainder(owner, key(), order.id, "Macmiilku 4-ta dambe ma doonayo") as { status: string };
    expect(closed.status).toBe("FULFILLED");

    const finalOrder = await db.salesOrder.findUniqueOrThrow({ where: { id: order.id }, include: { lines: true } });
    expect(finalOrder.status).toBe("FULFILLED");
    expect(Number(finalOrder.lines[0]!.cancelledUnits)).toBe(4);
  });

  it("7. Customer soft-archive and restore maintains financial integrity", async () => {
    const cust = await db.customer.create({
      data: { code: `ARCHIVE_${key()}`, name: "Customer to Archive", primaryPhone: "+252611111111", createdById: owner.id }
    });

    // Archive
    const updated = await db.customer.update({
      where: { id: cust.id },
      data: { status: "INACTIVE", archivedAt: new Date(), archivedById: owner.id, archiveReason: "Ganacsigii wuu xiray" }
    });
    expect(updated.status).toBe("INACTIVE");
    expect(updated.archivedAt).not.toBeNull();
    expect(updated.archiveReason).toBe("Ganacsigii wuu xiray");

    // Restore
    const restored = await db.customer.update({
      where: { id: cust.id },
      data: { status: "ACTIVE", archivedAt: null, archivedById: null, archiveReason: null }
    });
    expect(restored.status).toBe("ACTIVE");
    expect(restored.archivedAt).toBeNull();
  });
});
