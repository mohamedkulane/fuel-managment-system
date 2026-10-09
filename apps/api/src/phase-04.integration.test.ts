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

async function requestBuffer(path: string, cookie = ownerCookie): Promise<{ status: number; contentType: string; buffer: Buffer }> {
  const response = await fetch(`${base}/api/v1${path}`, {
    headers: {
      ...(cookie ? { cookie } : {})
    }
  });
  const arrayBuffer = await response.arrayBuffer();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    buffer: Buffer.from(arrayBuffer)
  };
}

describe("Phase 4 Dashboard, Reporting, Analytics & Production Readiness Integration Suite", () => {
  let dieselId = "";
  let unitId = "";
  let customerId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-p4-${suffix}@test.invalid`, displayName: "P4 Owner", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    const office = await prisma.user.create({
      data: { email: `office-p4-${suffix}@test.invalid`, displayName: "P4 Office", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
    });

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    dieselId = diesel.id;

    const unit = await prisma.salesUnit.create({ data: { code: `FUUSTO_P4_${suffix}`, name: "Fuusto P4 20L" } });
    unitId = unit.id;

    const effective = new Date(Date.now() - 3600_000).toISOString();
    await prisma.fuelUnitVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, litersPerUnit: new Prisma.Decimal("20"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });
    await prisma.priceVersion.create({
      data: { fuelId: diesel.id, salesUnitId: unit.id, unitPrice: new Prisma.Decimal("100"), effectiveFromUtc: new Date(effective), createdById: owner.id }
    });

    for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
      await prisma.stockBalance.upsert({
        where: { fuelId_location: { fuelId: diesel.id, location } },
        update: { balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") },
        create: { fuelId: diesel.id, location, balanceLiters: location === "WAREHOUSE" ? new Prisma.Decimal("50000") : new Prisma.Decimal("0") }
      });
    }

    const customer = await prisma.customer.create({
      data: { code: `CUS-P4-${suffix}`, name: "P4 Mogadishu Enterprise", primaryPhone: "+252619998877", createdById: owner.id }
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

  it("1. Health Endpoint returns 200 OK and uptime", async () => {
    const res = await fetch(`${base}/api/v1/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe("ok");
    expect(json.data.uptime).toBeGreaterThan(0);
  });

  it("2. Dashboard Overview returns real-time metrics", async () => {
    const ov = await request<{ customers: { total: number }; stock: { warehouse: Record<string, string> }; financials: { totalOutstandingDebt: string } }>("/dashboard/overview");
    expect(ov.customers.total).toBeGreaterThan(0);
    expect(ov.stock.warehouse.DIESEL).toBeDefined();
  });

  it("3. Dashboard Analytics returns sales and collections trends with Mogadishu date bounds", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const an = await request<{ period: { from: string; to: string }; salesTrend: any[]; topRevenue: any[] }>(`/dashboard/analytics?fromDate=${today}&toDate=${today}`);
    expect(an.period.from).toBe(today);
    expect(an.salesTrend).toBeDefined();
  });

  it("4 & 5. Reports: Customer Financial Position JSON & PDF/XLSX export", async () => {
    const json = await request<{ customers: any[]; totals: any }>("/reports/customers");
    expect(json.customers.length).toBeGreaterThan(0);

    const pdf = await requestBuffer("/reports/customers/pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.contentType).toContain("application/pdf");
    expect(pdf.buffer.length).toBeGreaterThan(100);

    const xlsx = await requestBuffer("/reports/customers/xlsx");
    expect(xlsx.status).toBe(200);
    expect(xlsx.contentType).toContain("spreadsheetml");
    expect(xlsx.buffer.length).toBeGreaterThan(100);
  });

  it("6 & 7. Reports: Debt Aging JSON & PDF/XLSX export", async () => {
    const json = await request<{ totals: any; customers: any[] }>("/reports/debts");
    expect(json.totals).toBeDefined();

    const pdf = await requestBuffer("/reports/debts/pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.contentType).toContain("application/pdf");

    const xlsx = await requestBuffer("/reports/debts/xlsx");
    expect(xlsx.status).toBe(200);
    expect(xlsx.contentType).toContain("spreadsheetml");
  });

  it("8 & 9. Reports: Customer Statement JSON & PDF/XLSX export", async () => {
    const json = await request<{ customer: any; entries: any[] }>(`/reports/statement?customerId=${customerId}`);
    expect(json.customer.id).toBe(customerId);

    const pdf = await requestBuffer(`/reports/statement/pdf?customerId=${customerId}`);
    expect(pdf.status).toBe(200);
    expect(pdf.contentType).toContain("application/pdf");

    const xlsx = await requestBuffer(`/reports/statement/xlsx?customerId=${customerId}`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.contentType).toContain("spreadsheetml");
  });

  it("10 & 11. Reports: Sales Orders JSON & PDF/XLSX export", async () => {
    const json = await request<{ items: any[] }>("/reports/sales");
    expect(json.items).toBeDefined();

    const pdf = await requestBuffer("/reports/sales/pdf");
    expect(pdf.status).toBe(200);
    expect(pdf.contentType).toContain("application/pdf");

    const xlsx = await requestBuffer("/reports/sales/xlsx");
    expect(xlsx.status).toBe(200);
    expect(xlsx.contentType).toContain("spreadsheetml");
  });

  it("12 & 13. Reports: Collections JSON & PDF/XLSX export", async () => {
    const json = await request<{ items: any[] }>("/reports/collections");
    expect(json.items).toBeDefined();

    const pdf = await requestBuffer("/reports/collections/pdf");
    expect(pdf.status).toBe(200);

    const xlsx = await requestBuffer("/reports/collections/xlsx");
    expect(xlsx.status).toBe(200);
  });

  it("14 & 15. Reports: Inventory Stock Balances JSON & PDF/XLSX export", async () => {
    const json = await request<{ items: any[] }>("/reports/inventory");
    expect(json.items.length).toBeGreaterThan(0);

    const pdf = await requestBuffer("/reports/inventory/pdf");
    expect(pdf.status).toBe(200);

    const xlsx = await requestBuffer("/reports/inventory/xlsx");
    expect(xlsx.status).toBe(200);
  });

  it("16. Tanker Receipts: Purchase costs included for OWNER, redacted for OFFICE_EMPLOYEE", async () => {
    const ownerRes = await request<{ items: any[] }>("/reports/tanker-receipts", {}, ownerCookie);
    expect(ownerRes.items).toBeDefined();

    const officeRes = await request<{ items: any[] }>("/reports/tanker-receipts", {}, officeCookie);
    expect(officeRes.items).toBeDefined();
    for (const item of officeRes.items) {
      expect(item.unitPurchaseCost).toBeUndefined();
      expect(item.totalPurchaseCost).toBeUndefined();
    }
  });

  it("17. Delivery Manifest & Reconciliation Report: Strict Non-Financial Data Isolation", async () => {
    const json = await request<{ items: any[] }>("/reports/deliveries");
    const str = JSON.stringify(json);
    expect(str).not.toMatch(/unitPrice|purchaseCost|revenue|debt|taxAmount|totalAmount/i);

    const pdf = await requestBuffer("/reports/deliveries/pdf");
    expect(pdf.status).toBe(200);
  });

  it("18. Invoices Report JSON & PDF/XLSX export", async () => {
    const json = await request<{ items: any[] }>("/reports/invoices");
    expect(json.items).toBeDefined();

    const pdf = await requestBuffer("/reports/invoices/pdf");
    expect(pdf.status).toBe(200);

    const xlsx = await requestBuffer("/reports/invoices/xlsx");
    expect(xlsx.status).toBe(200);
  });

  it("19. Profitability Report: OWNER allowed with disclosures; OFFICE_EMPLOYEE forbidden", async () => {
    const ownerRes = await request<{ revenue: any; purchaseCosts: any; disclosures: any }>("/reports/profitability", {}, ownerCookie);
    expect(ownerRes.revenue.confirmedInvoicedRevenue).toBeDefined();
    expect(ownerRes.disclosures.policyStatus).toBe("COST_PROFIT_FORMULA_UNCONFIRMED");

    const officeRes = await fetch(`${base}/api/v1/reports/profitability`, {
      headers: { cookie: officeCookie }
    });
    expect(officeRes.status).toBe(403);
  });

  it("20. Audit Trail: OWNER allowed; OFFICE_EMPLOYEE forbidden", async () => {
    const audits = await request<{ items: any[]; total: number }>("/audits", {}, ownerCookie);
    expect(audits.total).toBeGreaterThan(0);

    const officeRes = await fetch(`${base}/api/v1/audits`, {
      headers: { cookie: officeCookie }
    });
    expect(officeRes.status).toBe(403);
  });
});
