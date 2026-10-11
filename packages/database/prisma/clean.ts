import { PrismaClient, Prisma } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function clean(): Promise<void> {
  console.log("🧹 Starting complete system data cleanup...");

  // 1. Transactional Cleanup (in reverse foreign key dependency order)
  console.log("Removing payment allocations and reversals...");
  await prisma.paymentAllocation.deleteMany({});
  await prisma.paymentReversal.deleteMany({});

  console.log("Removing customer ledger entries and payments...");
  await prisma.customerLedgerEntry.deleteMany({});
  await prisma.payment.deleteMany({});

  console.log("Removing invoice lines and invoices...");
  await prisma.invoiceLine.deleteMany({});
  await prisma.invoice.deleteMany({});

  console.log("Removing delivery confirmations and lines...");
  await prisma.deliveryConfirmationLine.deleteMany({});
  await prisma.deliveryConfirmation.deleteMany({});

  console.log("Removing dispatches and dispatch lines...");
  await prisma.dispatchLine.deleteMany({});
  await prisma.dispatch.deleteMany({});

  console.log("Removing delivery sheet lines and delivery sheets...");
  await prisma.deliverySheetLine.deleteMany({});
  await prisma.deliverySheet.deleteMany({});

  console.log("Removing sales order events, lines, and orders...");
  await prisma.orderEvent.deleteMany({});
  await prisma.salesOrderLine.deleteMany({});
  await prisma.salesOrder.deleteMany({});

  console.log("Removing customer addresses and customers...");
  await prisma.customerAddress.deleteMany({});
  await prisma.customer.deleteMany({});

  console.log("Removing stock receipts and receipt lines...");
  await prisma.tankerReceiptLine.deleteMany({});
  await prisma.tankerReceipt.deleteMany({});

  console.log("Removing inventory movements...");
  await prisma.inventoryMovement.deleteMany({});

  console.log("Removing sessions and audit logs...");
  await prisma.session.deleteMany({});
  await prisma.auditEvent.deleteMany({});

  console.log("Removing test price versions and fuel unit versions...");
  await prisma.priceVersion.deleteMany({});
  await prisma.fuelUnitVersion.deleteMany({});

  console.log("Removing test users (preserving standard owner & office accounts)...");
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ["owner@fueldesk.so", "office@fueldesk.so"]
      }
    }
  });

  // 2. Ensure standard authenticated users exist
  console.log("Ensuring standard authentic users exist...");
  const ownerPasswordHash = await argon2.hash("OwnerPassword123!");
  const officePasswordHash = await argon2.hash("OfficePassword123!");

  const owner = await prisma.user.upsert({
    where: { email: "owner@fueldesk.so" },
    update: {
      displayName: "Super Owner",
      role: "OWNER",
      passwordHash: ownerPasswordHash,
      isActive: true
    },
    create: {
      email: "owner@fueldesk.so",
      displayName: "Super Owner",
      role: "OWNER",
      passwordHash: ownerPasswordHash,
      isActive: true
    }
  });

  const office = await prisma.user.upsert({
    where: { email: "office@fueldesk.so" },
    update: {
      displayName: "Office Staff",
      role: "OFFICE_EMPLOYEE",
      passwordHash: officePasswordHash,
      isActive: true
    },
    create: {
      email: "office@fueldesk.so",
      displayName: "Office Staff",
      role: "OFFICE_EMPLOYEE",
      passwordHash: officePasswordHash,
      isActive: true
    }
  });

  // 3. Ensure Master Fuel Products & Sales Units
  console.log("Ensuring master fuel products & sales units...");
  const diesel = await prisma.fuelType.upsert({
    where: { code: "DIESEL" },
    update: { displayName: "Diesel / Naafto", active: true },
    create: { code: "DIESEL", displayName: "Diesel / Naafto", active: true }
  });

  const petrol = await prisma.fuelType.upsert({
    where: { code: "PETROL" },
    update: { displayName: "Petrol / Basiin", active: true },
    create: { code: "PETROL", displayName: "Petrol / Basiin", active: true }
  });

  const fuusto = await prisma.salesUnit.upsert({
    where: { code: "FUUSTO" },
    update: { name: "Fuusto Container (240 L)", active: true },
    create: { code: "FUUSTO", name: "Fuusto Container (240 L)", active: true }
  });

  // 4. Reset Stock Balances to 0.000 Liters
  console.log("Resetting stock balances to 0.000 L...");
  for (const fuel of [diesel, petrol]) {
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: fuel.id, location: "WAREHOUSE" } },
      update: { balanceLiters: new Prisma.Decimal("0.000"), version: 0 },
      create: { fuelId: fuel.id, location: "WAREHOUSE", balanceLiters: new Prisma.Decimal("0.000"), version: 0 }
    });
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: fuel.id, location: "IN_TRANSIT" } },
      update: { balanceLiters: new Prisma.Decimal("0.000"), version: 0 },
      create: { fuelId: fuel.id, location: "IN_TRANSIT", balanceLiters: new Prisma.Decimal("0.000"), version: 0 }
    });
  }

  // 5. Canonical Conversions (1 Fuusto = 240 Liters)
  console.log("Setting baseline conversions (1 Fuusto = 240 L)...");
  const baselineDate = new Date("2026-01-01T00:00:00.000Z");

  await prisma.fuelUnitVersion.create({
    data: {
      fuelId: diesel.id,
      salesUnitId: fuusto.id,
      litersPerUnit: new Prisma.Decimal("240.000000"),
      effectiveFromUtc: baselineDate,
      createdById: owner.id
    }
  });

  await prisma.fuelUnitVersion.create({
    data: {
      fuelId: petrol.id,
      salesUnitId: fuusto.id,
      litersPerUnit: new Prisma.Decimal("240.000000"),
      effectiveFromUtc: baselineDate,
      createdById: owner.id
    }
  });

  // 6. Baseline Selling Prices ($100 / Fuusto for Diesel, $110 / Fuusto for Petrol)
  console.log("Setting baseline selling prices...");
  await prisma.priceVersion.create({
    data: {
      fuelId: diesel.id,
      salesUnitId: fuusto.id,
      unitPrice: new Prisma.Decimal("100.0000"),
      currencyCode: "USD",
      effectiveFromUtc: baselineDate,
      reason: "Initial clean baseline price",
      createdById: owner.id
    }
  });

  await prisma.priceVersion.create({
    data: {
      fuelId: petrol.id,
      salesUnitId: fuusto.id,
      unitPrice: new Prisma.Decimal("110.0000"),
      currencyCode: "USD",
      effectiveFromUtc: baselineDate,
      reason: "Initial clean baseline price",
      createdById: owner.id
    }
  });

  console.log("✅ Database successfully cleaned and set to fresh baseline state!");
}

clean()
  .catch((e) => {
    console.error("❌ Error cleaning database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
