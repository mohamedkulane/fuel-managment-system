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

describe("Optional Purchase Cost & Reciprocal Auto-Calculation Integration Suite", () => {
  let dieselId = "";

  beforeAll(async () => {
    prisma = new PrismaClient();
    const suffix = randomUUID().slice(0, 8);
    const ownerPassword = `Owner-${suffix}!`;
    const officePassword = `Office-${suffix}!`;

    const owner = await prisma.user.create({
      data: { email: `owner-cost-${suffix}@test.invalid`, displayName: "Owner Cost", role: "OWNER", passwordHash: await argon2.hash(ownerPassword) }
    });
    const office = await prisma.user.create({
      data: { email: `office-cost-${suffix}@test.invalid`, displayName: "Office Cost", role: "OFFICE_EMPLOYEE", passwordHash: await argon2.hash(officePassword) }
    });

    const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
    dieselId = diesel.id;

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

  it("1. Creates receipt WITHOUT purchase cost -> persists null, never 0", async () => {
    const draft = await request<{ id: string; lines: Array<{ unitPurchaseCost?: string | null; totalPurchaseCost?: string | null }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "No Cost Supplier",
        lines: [{ fuelId: dieselId, quantityFuusto: "50" }]
      })
    }, ownerCookie);

    expect(draft.lines[0]?.unitPurchaseCost).toBeNull();
    expect(draft.lines[0]?.totalPurchaseCost).toBeNull();

    // Verify raw DB record contains NULL, not 0
    const lineDb = await prisma.tankerReceiptLine.findFirst({ where: { receiptId: draft.id } });
    expect(lineDb?.unitPurchaseCost).toBeNull();
    expect(lineDb?.totalPurchaseCost).toBeNull();
  });

  it("2. Creates receipt WITH unitPurchaseCost -> auto-calculates totalPurchaseCost", async () => {
    const draft = await request<{ id: string; lines: Array<{ unitPurchaseCost?: string | null; totalPurchaseCost?: string | null }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "Unit Cost Supplier",
        lines: [{ fuelId: dieselId, quantityFuusto: "50", unitPurchaseCost: "190.00" }]
      })
    }, ownerCookie);

    expect(Number(draft.lines[0]?.unitPurchaseCost)).toBe(190);
    expect(Number(draft.lines[0]?.totalPurchaseCost)).toBe(9500); // 50 * 190 = 9500
  });

  it("3. Creates receipt WITH totalPurchaseCost -> auto-calculates unitPurchaseCost", async () => {
    const draft = await request<{ id: string; lines: Array<{ unitPurchaseCost?: string | null; totalPurchaseCost?: string | null }> }>("/stock/receipts", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        supplier: "Total Cost Supplier",
        lines: [{ fuelId: dieselId, quantityFuusto: "40", totalPurchaseCost: "8000.00" }]
      })
    }, ownerCookie);

    expect(Number(draft.lines[0]?.totalPurchaseCost)).toBe(8000);
    expect(Number(draft.lines[0]?.unitPurchaseCost)).toBe(200); // 8000 / 40 = 200
  });

  it("4. Verifies cost data is REDACTED for Office Employee role", async () => {
    const receiptsOffice = await request<Array<{ lines: Array<{ unitPurchaseCost?: string; totalPurchaseCost?: string }> }>>("/stock/receipts", {}, officeCookie);

    for (const r of receiptsOffice) {
      for (const line of r.lines) {
        expect(line.unitPurchaseCost).toBeUndefined();
        expect(line.totalPurchaseCost).toBeUndefined();
      }
    }

    const receiptsOwner = await request<Array<{ lines: Array<{ unitPurchaseCost?: string }> }>>("/stock/receipts", {}, ownerCookie);
    const hasAnyCost = receiptsOwner.some((r) => r.lines.some((l) => l.unitPurchaseCost !== undefined && l.unitPurchaseCost !== null));
    expect(hasAnyCost).toBe(true);
  });
});
