import { PrismaClient, Prisma } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("🌱 Starting idempotent UAT demonstration database seeding...");

  // 1. Authenticated Users (Owner & Office Employee)
  const ownerPasswordHash = await argon2.hash("OwnerPassword123!");
  const officePasswordHash = await argon2.hash("OfficePassword123!");

  const owner = await prisma.user.upsert({
    where: { email: "owner@fueldesk.so" },
    update: { displayName: "Super Owner", role: "OWNER", isActive: true },
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
    update: { displayName: "Office Staff", role: "OFFICE_EMPLOYEE", isActive: true },
    create: {
      email: "office@fueldesk.so",
      displayName: "Office Staff",
      role: "OFFICE_EMPLOYEE",
      passwordHash: officePasswordHash,
      isActive: true
    }
  });

  // 2. Master Fuel Products & Sales Units
  const diesel = await prisma.fuelType.upsert({
    where: { code: "DIESEL" },
    update: { displayName: "Diesel / Naafto" },
    create: { code: "DIESEL", displayName: "Diesel / Naafto", active: true }
  });

  const petrol = await prisma.fuelType.upsert({
    where: { code: "PETROL" },
    update: { displayName: "Petrol / Basiin" },
    create: { code: "PETROL", displayName: "Petrol / Basiin", active: true }
  });

  const fuusto = await prisma.salesUnit.upsert({
    where: { code: "FUUSTO" },
    update: { name: "Fuusto Container (Owner Configured Liters)" },
    create: { code: "FUUSTO", name: "Fuusto Container (Owner Configured Liters)", active: true }
  });

  // 3. Conversions & Price Versions
  const pastDate = new Date("2026-01-01T00:00:00.000Z");
  const updateDate = new Date("2026-06-01T00:00:00.000Z");

  // Diesel conversion: 240L/fuusto
  let dieselConv = await prisma.fuelUnitVersion.findFirst({
    where: { fuelId: diesel.id, salesUnitId: fuusto.id }
  });
  if (!dieselConv) {
    dieselConv = await prisma.fuelUnitVersion.create({
      data: {
        fuelId: diesel.id,
        salesUnitId: fuusto.id,
        litersPerUnit: new Prisma.Decimal("240.000000"),
        effectiveFromUtc: pastDate,
        createdById: owner.id
      }
    });
  } else {
    await prisma.fuelUnitVersion.update({
      where: { id: dieselConv.id },
      data: { litersPerUnit: new Prisma.Decimal("240.000000") }
    });
  }

  // Petrol conversion: 240L/fuusto
  let petrolConv = await prisma.fuelUnitVersion.findFirst({
    where: { fuelId: petrol.id, salesUnitId: fuusto.id }
  });
  if (!petrolConv) {
    petrolConv = await prisma.fuelUnitVersion.create({
      data: {
        fuelId: petrol.id,
        salesUnitId: fuusto.id,
        litersPerUnit: new Prisma.Decimal("240.000000"),
        effectiveFromUtc: pastDate,
        createdById: owner.id
      }
    });
  } else {
    await prisma.fuelUnitVersion.update({
      where: { id: petrolConv.id },
      data: { litersPerUnit: new Prisma.Decimal("240.000000") }
    });
  }

  // Historical Diesel Price ($100) -> Active Diesel Price ($120)
  let dieselPrice1 = await prisma.priceVersion.findFirst({
    where: { fuelId: diesel.id, salesUnitId: fuusto.id, unitPrice: new Prisma.Decimal("100.0000") }
  });
  if (!dieselPrice1) {
    dieselPrice1 = await prisma.priceVersion.create({
      data: {
        fuelId: diesel.id,
        salesUnitId: fuusto.id,
        unitPrice: new Prisma.Decimal("100.0000"),
        effectiveFromUtc: pastDate,
        effectiveToUtc: updateDate,
        reason: "Initial Q1 wholesale pricing",
        createdById: owner.id
      }
    });
  }

  let dieselPrice2 = await prisma.priceVersion.findFirst({
    where: { fuelId: diesel.id, salesUnitId: fuusto.id, unitPrice: new Prisma.Decimal("120.0000") }
  });
  if (!dieselPrice2) {
    dieselPrice2 = await prisma.priceVersion.create({
      data: {
        fuelId: diesel.id,
        salesUnitId: fuusto.id,
        unitPrice: new Prisma.Decimal("120.0000"),
        effectiveFromUtc: updateDate,
        reason: "Market rate adjustment Q3",
        createdById: owner.id
      }
    });
  }

  // Petrol Active Price ($110)
  let petrolPrice = await prisma.priceVersion.findFirst({
    where: { fuelId: petrol.id, salesUnitId: fuusto.id }
  });
  if (!petrolPrice) {
    petrolPrice = await prisma.priceVersion.create({
      data: {
        fuelId: petrol.id,
        salesUnitId: fuusto.id,
        unitPrice: new Prisma.Decimal("110.0000"),
        effectiveFromUtc: pastDate,
        reason: "Standard wholesale price",
        createdById: owner.id
      }
    });
  }

  // 4. Stock Balances & Booyad Tanker Receipts
  for (const fuel of [diesel, petrol]) {
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: fuel.id, location: "WAREHOUSE" } },
      update: { balanceLiters: fuel.code === "DIESEL" ? new Prisma.Decimal("9640.000") : new Prisma.Decimal("7600.000") },
      create: { fuelId: fuel.id, location: "WAREHOUSE", balanceLiters: fuel.code === "DIESEL" ? new Prisma.Decimal("9640.000") : new Prisma.Decimal("7600.000") }
    });
    await prisma.stockBalance.upsert({
      where: { fuelId_location: { fuelId: fuel.id, location: "IN_TRANSIT" } },
      update: { balanceLiters: new Prisma.Decimal("0.000") },
      create: { fuelId: fuel.id, location: "IN_TRANSIT", balanceLiters: new Prisma.Decimal("0.000") }
    });
  }

  // Posted Diesel Tanker Receipt (10,000L @ $0.80/L)
  const tankerReceipt1 = await prisma.tankerReceipt.upsert({
    where: { receiptNo: "BR-UAT-001" },
    update: {},
    create: {
      receiptNo: "BR-UAT-001",
      tankerReference: "Booyad Truck #SOM-901",
      arrivedAt: new Date("2026-09-01T08:00:00.000Z"),
      status: "POSTED",
      createdById: owner.id,
      postedById: owner.id,
      postedAt: new Date("2026-09-01T08:30:00.000Z"),
      postIdempotencyKey: "KEY-BR-UAT-001",
      lines: {
        create: [
          {
            fuelId: diesel.id,
            actualLiters: new Prisma.Decimal("10000.000"),
            expectedLiters: new Prisma.Decimal("10000.000"),
            unitPurchaseCost: new Prisma.Decimal("0.8000")
          }
        ]
      }
    }
  });

  // Posted Petrol Tanker Receipt (8,000L @ $0.85/L)
  const tankerReceipt2 = await prisma.tankerReceipt.upsert({
    where: { receiptNo: "BR-UAT-002" },
    update: {},
    create: {
      receiptNo: "BR-UAT-002",
      tankerReference: "Booyad Truck #SOM-902",
      arrivedAt: new Date("2026-09-05T10:00:00.000Z"),
      status: "POSTED",
      createdById: owner.id,
      postedById: owner.id,
      postedAt: new Date("2026-09-05T10:30:00.000Z"),
      postIdempotencyKey: "KEY-BR-UAT-002",
      lines: {
        create: [
          {
            fuelId: petrol.id,
            actualLiters: new Prisma.Decimal("8000.000"),
            expectedLiters: new Prisma.Decimal("8000.000"),
            unitPurchaseCost: new Prisma.Decimal("0.8500")
          }
        ]
      }
    }
  });

  // 5. Customers
  const customer1 = await prisma.customer.upsert({
    where: { code: "CUS-UAT-001" },
    update: {},
    create: {
      code: "CUS-UAT-001",
      name: "Banaadir Logistics & Transport",
      primaryPhone: "+252615551122",
      status: "ACTIVE",
      notes: "VIP Wholesale Customer",
      createdById: owner.id,
      addresses: {
        create: { label: "Primary Depot", addressText: "K4 Junction, Hodan District", city: "Mogadishu", isDefault: true }
      }
    }
  });

  const customer2 = await prisma.customer.upsert({
    where: { code: "CUS-UAT-002" },
    update: {},
    create: {
      code: "CUS-UAT-002",
      name: "Hodan Fuel Retailers",
      primaryPhone: "+252615553344",
      status: "ACTIVE",
      notes: "Prompt Payer",
      createdById: owner.id,
      addresses: {
        create: { label: "Retail Station", addressText: "Talaado Market, Hodan District", city: "Mogadishu", isDefault: true }
      }
    }
  });

  const customer3 = await prisma.customer.upsert({
    where: { code: "CUS-UAT-003" },
    update: {},
    create: {
      code: "CUS-UAT-003",
      name: "K4 Service Stations",
      primaryPhone: "+252615557788",
      status: "HOLD",
      creditLimit: new Prisma.Decimal("5000.00"),
      notes: "Account on hold due to overdue balance review",
      createdById: owner.id,
      addresses: {
        create: { label: "Station #1", addressText: "K4 Roundabout, Wadajir", city: "Mogadishu", isDefault: true }
      }
    }
  });

  const customer4 = await prisma.customer.upsert({
    where: { code: "CUS-UAT-004" },
    update: {},
    create: {
      code: "CUS-UAT-004",
      name: "Waberi Wholesale Traders",
      primaryPhone: "+252615559900",
      status: "ACTIVE",
      notes: "New account",
      createdById: owner.id,
      addresses: {
        create: { label: "Main Depot", addressText: "21 October Road, Waberi", city: "Mogadishu", isDefault: true }
      }
    }
  });

  // 6. Orders, Dispatches, Reconciliations & Invoices

  // Order #1: Customer 1 (Banaadir) - Confirmed @ $100, 18 accepted / 2 returned, Invoiced $1,800, $500 paid, $1,300 debt.
  let order1 = await prisma.salesOrder.findUnique({ where: { orderNo: "SO-UAT-001" } });
  if (!order1) {
    order1 = await prisma.salesOrder.create({
      data: {
        orderNo: "SO-UAT-001",
        customerId: customer1.id,
        orderDate: new Date("2026-09-10T09:00:00.000Z"),
        addressSnapshot: "K4 Junction, Hodan District, Mogadishu",
        status: "FULFILLED",
        createdById: office.id,
        confirmedById: office.id,
        confirmedAt: new Date("2026-09-10T09:15:00.000Z"),
        lines: {
          create: [
            {
              fuelId: diesel.id,
              salesUnitId: fuusto.id,
              requestedUnits: new Prisma.Decimal("20.000"),
              conversionVersionId: dieselConv.id,
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000"),
              requestedLitersSnapshot: new Prisma.Decimal("400.000"),
              priceVersionId: dieselPrice1.id,
              unitPriceSnapshot: new Prisma.Decimal("100.0000"),
              confirmedAt: new Date("2026-09-10T09:15:00.000Z")
            }
          ]
        }
      }
    });

    const order1Line = await prisma.salesOrderLine.findFirstOrThrow({ where: { orderId: order1.id } });

    const sheet1 = await prisma.deliverySheet.create({
      data: {
        sheetNo: "DS-UAT-001",
        serviceDate: new Date("2026-09-10T00:00:00.000Z"),
        status: "RECONCILED",
        createdById: office.id,
        lines: {
          create: [
            {
              orderLineId: order1Line.id,
              scheduledUnits: new Prisma.Decimal("20.000"),
              orderNoSnapshot: "SO-UAT-001",
              displayCustomerNameSnapshot: "Banaadir Logistics & Transport",
              phoneSnapshot: "+252615551122",
              addressSnapshot: "K4 Junction, Hodan District, Mogadishu",
              fuelLabelSnapshot: "Diesel / Naafto"
            }
          ]
        }
      }
    });

    const dispatch1 = await prisma.dispatch.create({
      data: {
        dispatchNo: "DP-UAT-001",
        deliverySheetId: sheet1.id,
        status: "RECONCILED",
        dispatchedAt: new Date("2026-09-10T10:00:00.000Z"),
        postedById: office.id,
        postedAt: new Date("2026-09-10T10:00:00.000Z"),
        idempotencyKey: "KEY-DP-UAT-001",
        lines: {
          create: [
            {
              orderLineId: order1Line.id,
              dispatchedUnits: new Prisma.Decimal("20.000"),
              dispatchedLiters: new Prisma.Decimal("400.000"),
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000")
            }
          ]
        }
      }
    });

    const dispatch1Line = await prisma.dispatchLine.findFirstOrThrow({ where: { dispatchId: dispatch1.id } });

    const conf1 = await prisma.deliveryConfirmation.create({
      data: {
        confirmationNo: "DC-UAT-001",
        dispatchId: dispatch1.id,
        confirmedAt: new Date("2026-09-10T14:00:00.000Z"),
        recordedById: office.id,
        idempotencyKey: "KEY-DC-UAT-001",
        lines: {
          create: [
            {
              dispatchLineId: dispatch1Line.id,
              acceptedUnits: new Prisma.Decimal("18.000"),
              acceptedLiters: new Prisma.Decimal("360.000"),
              physicalReturnedLiters: new Prisma.Decimal("40.000"),
              commercialDisposition: "CANCEL_REMAINDER",
              discrepancyReason: "2 fuusto physically returned due to minor leak",
              billingSourceKey: "BSK-UAT-001"
            }
          ]
        }
      }
    });

    const conf1Line = await prisma.deliveryConfirmationLine.findFirstOrThrow({ where: { confirmationId: conf1.id } });

    // Commercial Invoice #1: 18 accepted @ $100 = $1,800
    const inv1 = await prisma.invoice.create({
      data: {
        invoiceNo: "INV-UAT-001",
        customerId: customer1.id,
        deliveryConfirmationLineId: conf1Line.id,
        billingSourceKey: "BSK-UAT-001",
        issueDate: new Date("2026-09-10T15:00:00.000Z"),
        dueDate: new Date("2026-09-24T15:00:00.000Z"),
        status: "PARTIALLY_PAID",
        subtotal: new Prisma.Decimal("1800.0000"),
        taxAmount: new Prisma.Decimal("0.0000"),
        totalAmount: new Prisma.Decimal("1800.0000"),
        paidAmount: new Prisma.Decimal("500.0000"),
        balanceDue: new Prisma.Decimal("1300.0000"),
        createdById: office.id,
        lines: {
          create: [
            {
              orderLineId: order1Line.id,
              fuelId: diesel.id,
              salesUnitId: fuusto.id,
              acceptedUnits: new Prisma.Decimal("18.000"),
              acceptedLiters: new Prisma.Decimal("360.000"),
              unitPriceSnapshot: new Prisma.Decimal("100.0000"),
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000"),
              lineTotal: new Prisma.Decimal("1800.0000")
            }
          ]
        }
      }
    });

    // Subledger Entry: Invoice
    await prisma.customerLedgerEntry.create({
      data: {
        customerId: customer1.id,
        occurredAt: new Date("2026-09-10T15:00:00.000Z"),
        entryType: "INVOICE",
        referenceNo: "INV-UAT-001",
        debitAmount: new Prisma.Decimal("1800.0000"),
        creditAmount: new Prisma.Decimal("0.0000"),
        runningBalance: new Prisma.Decimal("1800.0000"),
        sourceType: "Invoice",
        sourceId: inv1.id,
        notes: "Invoice for 18 accepted Diesel fuusto"
      }
    });

    // Payment #1: $500 partial payment
    const pay1 = await prisma.payment.create({
      data: {
        paymentNo: "PAY-UAT-001",
        customerId: customer1.id,
        amount: new Prisma.Decimal("500.0000"),
        allocatedAmount: new Prisma.Decimal("500.0000"),
        unappliedAmount: new Prisma.Decimal("0.0000"),
        paymentDate: new Date("2026-09-12T10:00:00.000Z"),
        paymentMethod: "EVC_PLUS",
        reference: "EVC-998877",
        status: "POSTED",
        recordedById: office.id,
        idempotencyKey: "KEY-PAY-UAT-001"
      }
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: pay1.id,
        invoiceId: inv1.id,
        amount: new Prisma.Decimal("500.0000"),
        createdById: office.id
      }
    });

    // Subledger Entry: Payment
    await prisma.customerLedgerEntry.create({
      data: {
        customerId: customer1.id,
        occurredAt: new Date("2026-09-12T10:00:00.000Z"),
        entryType: "PAYMENT",
        referenceNo: "PAY-UAT-001",
        debitAmount: new Prisma.Decimal("0.0000"),
        creditAmount: new Prisma.Decimal("500.0000"),
        runningBalance: new Prisma.Decimal("1300.0000"),
        sourceType: "Payment",
        sourceId: pay1.id,
        notes: "Partial payment via EVC Plus"
      }
    });
  }

  // Order #2: Customer 2 (Hodan) - Confirmed @ $120, 20 accepted, Fully Paid ($2,400)
  let order2 = await prisma.salesOrder.findUnique({ where: { orderNo: "SO-UAT-002" } });
  if (!order2) {
    order2 = await prisma.salesOrder.create({
      data: {
        orderNo: "SO-UAT-002",
        customerId: customer2.id,
        orderDate: new Date("2026-09-15T09:00:00.000Z"),
        addressSnapshot: "Talaado Market, Hodan District, Mogadishu",
        status: "FULFILLED",
        createdById: office.id,
        confirmedById: office.id,
        confirmedAt: new Date("2026-09-15T09:15:00.000Z"),
        lines: {
          create: [
            {
              fuelId: diesel.id,
              salesUnitId: fuusto.id,
              requestedUnits: new Prisma.Decimal("20.000"),
              conversionVersionId: dieselConv.id,
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000"),
              requestedLitersSnapshot: new Prisma.Decimal("400.000"),
              priceVersionId: dieselPrice2.id,
              unitPriceSnapshot: new Prisma.Decimal("120.0000"),
              confirmedAt: new Date("2026-09-15T09:15:00.000Z")
            }
          ]
        }
      }
    });

    const order2Line = await prisma.salesOrderLine.findFirstOrThrow({ where: { orderId: order2.id } });

    const sheet2 = await prisma.deliverySheet.create({
      data: {
        sheetNo: "DS-UAT-002",
        serviceDate: new Date("2026-09-15T00:00:00.000Z"),
        status: "RECONCILED",
        createdById: office.id,
        lines: {
          create: [
            {
              orderLineId: order2Line.id,
              scheduledUnits: new Prisma.Decimal("20.000"),
              orderNoSnapshot: "SO-UAT-002",
              displayCustomerNameSnapshot: "Hodan Fuel Retailers",
              phoneSnapshot: "+252615553344",
              addressSnapshot: "Talaado Market, Hodan District, Mogadishu",
              fuelLabelSnapshot: "Diesel / Naafto"
            }
          ]
        }
      }
    });

    const dispatch2 = await prisma.dispatch.create({
      data: {
        dispatchNo: "DP-UAT-002",
        deliverySheetId: sheet2.id,
        status: "RECONCILED",
        dispatchedAt: new Date("2026-09-15T10:00:00.000Z"),
        postedById: office.id,
        postedAt: new Date("2026-09-15T10:00:00.000Z"),
        idempotencyKey: "KEY-DP-UAT-002",
        lines: {
          create: [
            {
              orderLineId: order2Line.id,
              dispatchedUnits: new Prisma.Decimal("20.000"),
              dispatchedLiters: new Prisma.Decimal("400.000"),
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000")
            }
          ]
        }
      }
    });

    const dispatch2Line = await prisma.dispatchLine.findFirstOrThrow({ where: { dispatchId: dispatch2.id } });

    const conf2 = await prisma.deliveryConfirmation.create({
      data: {
        confirmationNo: "DC-UAT-002",
        dispatchId: dispatch2.id,
        confirmedAt: new Date("2026-09-15T14:00:00.000Z"),
        recordedById: office.id,
        idempotencyKey: "KEY-DC-UAT-002",
        lines: {
          create: [
            {
              dispatchLineId: dispatch2Line.id,
              acceptedUnits: new Prisma.Decimal("20.000"),
              acceptedLiters: new Prisma.Decimal("400.000"),
              physicalReturnedLiters: new Prisma.Decimal("0.000"),
              commercialDisposition: "NONE",
              billingSourceKey: "BSK-UAT-002"
            }
          ]
        }
      }
    });

    const conf2Line = await prisma.deliveryConfirmationLine.findFirstOrThrow({ where: { confirmationId: conf2.id } });

    const inv2 = await prisma.invoice.create({
      data: {
        invoiceNo: "INV-UAT-002",
        customerId: customer2.id,
        deliveryConfirmationLineId: conf2Line.id,
        billingSourceKey: "BSK-UAT-002",
        issueDate: new Date("2026-09-15T15:00:00.000Z"),
        dueDate: new Date("2026-09-29T15:00:00.000Z"),
        status: "PAID",
        subtotal: new Prisma.Decimal("2400.0000"),
        taxAmount: new Prisma.Decimal("0.0000"),
        totalAmount: new Prisma.Decimal("2400.0000"),
        paidAmount: new Prisma.Decimal("2400.0000"),
        balanceDue: new Prisma.Decimal("0.0000"),
        createdById: office.id,
        lines: {
          create: [
            {
              orderLineId: order2Line.id,
              fuelId: diesel.id,
              salesUnitId: fuusto.id,
              acceptedUnits: new Prisma.Decimal("20.000"),
              acceptedLiters: new Prisma.Decimal("400.000"),
              unitPriceSnapshot: new Prisma.Decimal("120.0000"),
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000"),
              lineTotal: new Prisma.Decimal("2400.0000")
            }
          ]
        }
      }
    });

    await prisma.customerLedgerEntry.create({
      data: {
        customerId: customer2.id,
        occurredAt: new Date("2026-09-15T15:00:00.000Z"),
        entryType: "INVOICE",
        referenceNo: "INV-UAT-002",
        debitAmount: new Prisma.Decimal("2400.0000"),
        creditAmount: new Prisma.Decimal("0.0000"),
        runningBalance: new Prisma.Decimal("2400.0000"),
        sourceType: "Invoice",
        sourceId: inv2.id,
        notes: "Invoice for 20 accepted Diesel fuusto"
      }
    });

    const pay2 = await prisma.payment.create({
      data: {
        paymentNo: "PAY-UAT-002",
        customerId: customer2.id,
        amount: new Prisma.Decimal("2400.0000"),
        allocatedAmount: new Prisma.Decimal("2400.0000"),
        unappliedAmount: new Prisma.Decimal("0.0000"),
        paymentDate: new Date("2026-09-16T11:00:00.000Z"),
        paymentMethod: "BANK_TRANSFER",
        reference: "BANK-TR-8811",
        status: "POSTED",
        recordedById: office.id,
        idempotencyKey: "KEY-PAY-UAT-002"
      }
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: pay2.id,
        invoiceId: inv2.id,
        amount: new Prisma.Decimal("2400.0000"),
        createdById: office.id
      }
    });

    await prisma.customerLedgerEntry.create({
      data: {
        customerId: customer2.id,
        occurredAt: new Date("2026-09-16T11:00:00.000Z"),
        entryType: "PAYMENT",
        referenceNo: "PAY-UAT-002",
        debitAmount: new Prisma.Decimal("0.0000"),
        creditAmount: new Prisma.Decimal("2400.0000"),
        runningBalance: new Prisma.Decimal("0.0000"),
        sourceType: "Payment",
        sourceId: pay2.id,
        notes: "Full payment via Bank Transfer"
      }
    });
  }

  // Order #3: Customer 1 (Banaadir) - New order created while existing $1,300 debt remains
  let order3 = await prisma.salesOrder.findUnique({ where: { orderNo: "SO-UAT-003" } });
  if (!order3) {
    order3 = await prisma.salesOrder.create({
      data: {
        orderNo: "SO-UAT-003",
        customerId: customer1.id,
        orderDate: new Date("2026-09-20T10:00:00.000Z"),
        addressSnapshot: "K4 Junction, Hodan District, Mogadishu",
        status: "CONFIRMED",
        createdById: office.id,
        confirmedById: office.id,
        confirmedAt: new Date("2026-09-20T10:15:00.000Z"),
        lines: {
          create: [
            {
              fuelId: diesel.id,
              salesUnitId: fuusto.id,
              requestedUnits: new Prisma.Decimal("10.000"),
              conversionVersionId: dieselConv.id,
              litersPerUnitSnapshot: new Prisma.Decimal("20.000000"),
              requestedLitersSnapshot: new Prisma.Decimal("200.000"),
              priceVersionId: dieselPrice2.id,
              unitPriceSnapshot: new Prisma.Decimal("120.0000"),
              confirmedAt: new Date("2026-09-20T10:15:00.000Z")
            }
          ]
        }
      }
    });
  }

  // 7. Audit Log Events
  await prisma.auditEvent.createMany({
    data: [
      {
        actorId: owner.id,
        entityType: "PriceVersion",
        entityId: dieselPrice2.id,
        action: "CREATED",
        afterRedacted: { unitPrice: "120.0000", fuel: "DIESEL" },
        reason: "Market price adjustment Q3"
      },
      {
        actorId: owner.id,
        entityType: "TankerReceipt",
        entityId: tankerReceipt1.id,
        action: "POSTED",
        reason: "Booyad Diesel receipt posting 10,000L"
      },
      {
        actorId: office.id,
        entityType: "SalesOrder",
        entityId: order1.id,
        action: "CONFIRMED",
        reason: "Order confirmed by office staff"
      }
    ]
  });

  console.log("✅ UAT demonstration database seeding completed successfully!");
  console.log("----------------------------------------------------------");
  console.log("Authenticated Test Accounts:");
  console.log("  1. Owner:           owner@fueldesk.so    (Password: OwnerPassword123!)");
  console.log("  2. Office Employee: office@fueldesk.so   (Password: OfficePassword123!)");
  console.log("----------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
