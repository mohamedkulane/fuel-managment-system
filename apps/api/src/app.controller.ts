import { statementBounds, statementRows } from "./customer-statement.js";
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req, Res, UseGuards, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import argon2 from "argon2";
import PDFDocument from "pdfkit";
import { Prisma, PrismaClient } from "@fuel/database";
import { deliveryManifestLineSchema } from "@fuel/shared";
import { AuthenticatedRequest, hashToken, newSessionToken, requireActor, requireOwner, SessionGuard } from "./auth.js";
import { PrismaService } from "./prisma.service.js";
import { exportToPdf, exportToExcel, ColumnDef } from "./reports.exporter.js";
import { compactPaymentReference, createCustomerStatementPdf } from "./customer-statement.pdf.js";
import { addDocumentFooter, drawDocumentLogo, resolveDocumentBranding, validateLogoUrl } from "./document-branding.js";
import { CustomerAccountService } from "./customer-account.service.js";
import { SimpleWorkflowsService } from "./simple-workflows.service.js";

type DecimalInput = string;
const dec = (value: DecimalInput): Prisma.Decimal => new Prisma.Decimal(value);
const positive = (value: string, name: string): Prisma.Decimal => { const result = dec(value); if (result.lte(0)) throw new BadRequestException(`${name} must be positive`); return result; };
const localDate = (value: string): Date => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException("Date must be YYYY-MM-DD"); return new Date(`${value}T00:00:00.000Z`); };
const documentNo = (prefix: string): string => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
const jsonDecimal = (value: Prisma.Decimal | null | undefined): string | null => value?.toFixed(6) ?? null;
const requireIdempotencyKey = (value: string | undefined): string => {
  const key = value?.trim();
  if (!key || key.length < 12 || key.length > 200) throw new BadRequestException("A valid Idempotency-Key header is required");
  return key;
};

@Controller("api/v1")
export class AppController {
  public constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CustomerAccountService) private readonly customerAccounts: CustomerAccountService,
    @Inject(SimpleWorkflowsService) private readonly simpleWorkflows: SimpleWorkflowsService
  ) {}

  private async documentBranding() {
    const settings = await this.prisma.documentBranding.findUnique({ where: { id: "global" } });
    return resolveDocumentBranding(settings);
  }

  private async exportPdf(options: Parameters<typeof exportToPdf>[0]) {
    return exportToPdf({ ...options, branding: await this.documentBranding() });
  }

  private async exportExcel(options: Parameters<typeof exportToExcel>[0]) {
    return exportToExcel({ ...options, branding: await this.documentBranding() });
  }

  @Post("auth/login")
  async login(@Body() body: { email?: string; password?: string }, @Res({ passthrough: true }) response: Response) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) throw new BadRequestException("Email and password are required");
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, body.password))) throw new ForbiddenException("Invalid credentials");
    const token = newSessionToken();
    await this.prisma.session.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12) } });
    response.cookie("fuel_sid", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12, path: "/" });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return { data: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
  }

  @UseGuards(SessionGuard)
  @Post("auth/logout")
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    const token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("fuel_sid="))?.slice(9);
    if (token) await this.prisma.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    response.clearCookie("fuel_sid", { httpOnly: true, sameSite: "lax", path: "/" });
    return { data: { loggedOut: true } };
  }

  @UseGuards(SessionGuard)
  @Get("auth/me")
  me(@Req() request: AuthenticatedRequest) { return { data: requireActor(request) }; }

  @UseGuards(SessionGuard)
  @Get("fuels")
  async fuels() { return { data: await this.prisma.fuelType.findMany({ where: { active: true }, orderBy: { code: "asc" } }) }; }

  @UseGuards(SessionGuard)
  @Get("sales-units")
  async salesUnits() { return { data: await this.prisma.salesUnit.findMany({ where: { active: true }, orderBy: { code: "asc" } }) }; }

  @UseGuards(SessionGuard)
  @Get("stock/balances")
  async balances() {
    const rows = await this.prisma.stockBalance.findMany({ include: { fuel: true }, orderBy: [{ fuel: { code: "asc" } }, { location: "asc" }] });
    return {
      data: rows.map((row) => ({
        fuel: row.fuel.code,
        fuelName: row.fuel.displayName,
        location: row.location,
        balanceFuusto: row.balanceLiters.div(240).toFixed(3),
        balanceLiters: row.balanceLiters.toFixed(3)
      }))
    };
  }

  @UseGuards(SessionGuard)
  @Get("stock/movements")
  async stockMovements(
    @Query("fuelId") fuelId?: string,
    @Query("location") location?: "WAREHOUSE" | "IN_TRANSIT",
    @Query("eventType") eventType?: "RECEIPT" | "DISPATCH" | "ACCEPTED" | "RETURN" | "ADJUSTMENT" | "REVERSAL",
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string
  ) {
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryMovementWhereInput = {
      ...(fuelId ? { fuelId } : {}),
      ...(location ? { location } : {}),
      ...(eventType ? { eventType } : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: { fuel: true },
        orderBy: { occurredAt: "desc" },
        skip,
        take: limit
      }),
      this.prisma.inventoryMovement.count({ where })
    ]);

    return {
      data: {
        items: rows.map((row) => ({
          id: row.id,
          fuel: row.fuel.code,
          fuelName: row.fuel.displayName,
          location: row.location,
          eventType: row.eventType,
          quantityFuusto: row.signedDeltaLiters.div(240).toFixed(3),
          quantityLiters: row.signedDeltaLiters.toFixed(3),
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          occurredAt: row.occurredAt
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("stock/adjustments")
  async adjustStock(@Req() request: AuthenticatedRequest, @Body() body: { fuelId?: string; signedDeltaLiters?: string; reason?: string }) {
    const actor = requireOwner(request);
    if (!body.fuelId || !body.signedDeltaLiters || !body.reason?.trim()) throw new BadRequestException("fuelId, signedDeltaLiters and reason are required");
    const delta = dec(body.signedDeltaLiters);
    if (delta.eq(0)) throw new BadRequestException("signedDeltaLiters cannot be zero");
    const result = await this.prisma.$transaction(async (tx) => {
      const where = { fuelId_location: { fuelId: body.fuelId!, location: "WAREHOUSE" as const } };
      if (delta.lt(0)) {
        const changed = await tx.stockBalance.updateMany({ where: { fuelId: body.fuelId!, location: "WAREHOUSE", balanceLiters: { gte: delta.abs() } }, data: { balanceLiters: { decrement: delta.abs() }, version: { increment: 1 } } });
        if (changed.count !== 1) throw new BadRequestException("Adjustment would make warehouse stock negative");
      } else {
        await tx.stockBalance.update({ where, data: { balanceLiters: { increment: delta }, version: { increment: 1 } } });
      }
      const movement = await tx.inventoryMovement.create({ data: { fuelId: body.fuelId!, location: "WAREHOUSE", signedDeltaLiters: delta, eventType: "ADJUSTMENT", sourceType: "StockAdjustment", sourceId: documentNo("ADJ"), createdById: actor.id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "InventoryMovement", entityId: movement.id, action: "ADJUSTED", reason: body.reason } });
      return movement;
    });
    return { data: { ...result, signedDeltaLiters: result.signedDeltaLiters.toFixed(3) } };
  }

  @UseGuards(SessionGuard)
  @Get("units")
  async units(@Req() request: AuthenticatedRequest) {
    const rows = await this.prisma.fuelUnitVersion.findMany({ include: { fuel: true, salesUnit: true }, orderBy: [{ fuel: { code: "asc" } }, { effectiveFromUtc: "desc" }] });
    return { data: rows.map((row) => ({ id: row.id, fuel: row.fuel.code, unit: row.salesUnit.code, litersPerUnit: row.litersPerUnit.toFixed(6), effectiveFromUtc: row.effectiveFromUtc, canEdit: request.actor?.role === "OWNER" })) };
  }

  @UseGuards(SessionGuard)
  @Post("units")
  async createUnit(@Req() request: AuthenticatedRequest, @Body() body: { fuelId?: string; salesUnitId?: string; litersPerUnit?: string; effectiveFromUtc?: string }) {
    const actor = requireOwner(request);
    if (!body.fuelId || !body.salesUnitId || !body.litersPerUnit || !body.effectiveFromUtc) throw new BadRequestException("fuelId, salesUnitId, litersPerUnit and effectiveFromUtc are required");
    const liters = positive(body.litersPerUnit, "litersPerUnit");
    if (!liters.eq(240)) throw new BadRequestException("1 FUUSTO is fixed at 240 liters");
    const effective = new Date(body.effectiveFromUtc);
    if (Number.isNaN(effective.getTime())) throw new BadRequestException("Invalid effectiveFromUtc");
    const overlap = await this.prisma.fuelUnitVersion.findFirst({
      where: {
        fuelId: body.fuelId,
        salesUnitId: body.salesUnitId,
        OR: [
          { effectiveFromUtc: { lte: effective }, effectiveToUtc: { gt: effective } },
          { effectiveFromUtc: { gte: effective } }
        ]
      }
    });
    if (overlap) throw new BadRequestException("Conversion effective period overlaps an existing version");
    const previous = await this.prisma.fuelUnitVersion.findFirst({ where: { fuelId: body.fuelId, salesUnitId: body.salesUnitId, effectiveFromUtc: { lt: effective } }, orderBy: { effectiveFromUtc: "desc" } });
    const created = await this.prisma.$transaction(async (tx) => {
      if (previous && !previous.effectiveToUtc) await tx.fuelUnitVersion.update({ where: { id: previous.id }, data: { effectiveToUtc: effective } });
      const row = await tx.fuelUnitVersion.create({ data: { fuelId: body.fuelId!, salesUnitId: body.salesUnitId!, litersPerUnit: liters, effectiveFromUtc: effective, createdById: actor.id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "FuelUnitVersion", entityId: row.id, action: "CREATED", afterRedacted: { fuelId: row.fuelId, salesUnitId: row.salesUnitId, litersPerUnit: row.litersPerUnit.toFixed(6) } } });
      return row;
    });
    return { data: { ...created, litersPerUnit: created.litersPerUnit.toFixed(6) } };
  }

  @UseGuards(SessionGuard)
  @Get("prices/current")
  async currentPrice(@Query("fuelId") fuelId?: string, @Query("unitId") unitId?: string) {
    if (!fuelId || !unitId) throw new BadRequestException("fuelId and unitId are required");
    const row = await this.prisma.priceVersion.findFirst({ where: { fuelId, salesUnitId: unitId, effectiveFromUtc: { lte: new Date() }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: new Date() } }] }, orderBy: { effectiveFromUtc: "desc" } });
    return { data: row ? { id: row.id, unitPrice: row.unitPrice.toFixed(4), currencyCode: row.currencyCode, effectiveFromUtc: row.effectiveFromUtc } : null };
  }

  @UseGuards(SessionGuard)
  @Get("prices/history")
  async priceHistory() {
    const rows = await this.prisma.priceVersion.findMany({
      include: { fuel: true, salesUnit: true, createdBy: { select: { displayName: true } } },
      orderBy: { effectiveFromUtc: "desc" }
    });
    return {
      data: rows.map((row) => ({
        ...row,
        unitPrice: row.unitPrice.toFixed(4),
        createdByName: row.createdBy?.displayName ?? "System"
      }))
    };
  }

  @UseGuards(SessionGuard)
  @Post("prices")
  async createPrice(@Req() request: AuthenticatedRequest, @Body() body: { fuelId?: string; salesUnitId?: string; unitPrice?: string; effectiveFromUtc?: string; reason?: string }) {
    const actor = requireOwner(request);
    if (!body.fuelId || !body.salesUnitId || !body.unitPrice || !body.effectiveFromUtc) throw new BadRequestException("fuelId, salesUnitId, unitPrice and effectiveFromUtc are required");
    const price = positive(body.unitPrice, "unitPrice"); const effective = new Date(body.effectiveFromUtc); if (Number.isNaN(effective.getTime())) throw new BadRequestException("Invalid effectiveFromUtc");
    const overlap = await this.prisma.priceVersion.findFirst({
      where: {
        fuelId: body.fuelId,
        salesUnitId: body.salesUnitId,
        OR: [
          { effectiveFromUtc: { lte: effective }, effectiveToUtc: { gt: effective } },
          { effectiveFromUtc: { gte: effective } }
        ]
      }
    });
    if (overlap) throw new BadRequestException("Price effective period overlaps an existing version");
    const previous = await this.prisma.priceVersion.findFirst({ where: { fuelId: body.fuelId, salesUnitId: body.salesUnitId, effectiveFromUtc: { lt: effective } }, orderBy: { effectiveFromUtc: "desc" } });
    const row = await this.prisma.$transaction(async (tx) => { if (previous && !previous.effectiveToUtc) await tx.priceVersion.update({ where: { id: previous.id }, data: { effectiveToUtc: effective } }); const created = await tx.priceVersion.create({ data: { fuelId: body.fuelId!, salesUnitId: body.salesUnitId!, unitPrice: price, effectiveFromUtc: effective, reason: body.reason, createdById: actor.id } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "PriceVersion", entityId: created.id, action: "CREATED", afterRedacted: { fuelId: created.fuelId, salesUnitId: created.salesUnitId, unitPrice: created.unitPrice.toFixed(4) } } }); return created; });
    return { data: { ...row, unitPrice: row.unitPrice.toFixed(4) } };
  }

  @UseGuards(SessionGuard)
  @Get(["stock/receipts", "tanker-receipts"])
  async receipts(@Req() request: AuthenticatedRequest) {
    const rows = await this.prisma.tankerReceipt.findMany({ include: { lines: { include: { fuel: true } } }, orderBy: { arrivedAt: "desc" } });
    const isOwner = request.actor?.role === "OWNER";
    return {
      data: rows.map((row) => ({
        ...row,
        supplier: row.tankerReference,
        lines: row.lines.map((line) => {
          const fuusto = line.quantityFuusto ? line.quantityFuusto : line.actualLiters.div(240);
          const totalCost = line.totalPurchaseCost ?? (line.unitPurchaseCost ? line.unitPurchaseCost.mul(fuusto) : null);
          return {
            ...line,
            quantityFuusto: fuusto.toFixed(3),
            litersPerFuustoSnapshot: line.litersPerFuustoSnapshot?.toFixed(6) ?? "240.000000",
            actualLiters: line.actualLiters.toFixed(3),
            expectedLiters: line.expectedLiters?.toFixed(3) ?? null,
            unitPurchaseCost: isOwner ? line.unitPurchaseCost?.toFixed(4) ?? null : undefined,
            totalPurchaseCost: isOwner ? totalCost?.toFixed(4) ?? null : undefined
          };
        })
      }))
    };
  }

  @UseGuards(SessionGuard)
  @Get(["stock/receipts/:id", "tanker-receipts/:id"])
  async receipt(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const row = await this.prisma.tankerReceipt.findUnique({ where: { id }, include: { lines: { include: { fuel: true } }, createdBy: true, postedBy: true } });
    if (!row) throw new NotFoundException("Stock receipt not found");
    const isOwner = request.actor?.role === "OWNER";
    return {
      data: {
        ...row,
        supplier: row.tankerReference,
        lines: row.lines.map((line) => {
          const fuusto = line.quantityFuusto ? line.quantityFuusto : line.actualLiters.div(240);
          const totalCost = line.totalPurchaseCost ?? (line.unitPurchaseCost ? line.unitPurchaseCost.mul(fuusto) : null);
          return {
            ...line,
            quantityFuusto: fuusto.toFixed(3),
            litersPerFuustoSnapshot: line.litersPerFuustoSnapshot?.toFixed(6) ?? "240.000000",
            actualLiters: line.actualLiters.toFixed(3),
            expectedLiters: line.expectedLiters?.toFixed(3) ?? null,
            unitPurchaseCost: isOwner ? line.unitPurchaseCost?.toFixed(4) ?? null : undefined,
            totalPurchaseCost: isOwner ? totalCost?.toFixed(4) ?? null : undefined
          };
        })
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post(["stock/receipts", "tanker-receipts"])
  async createReceipt(
    @Req() request: AuthenticatedRequest,
    @Body()
    body: {
      supplier?: string;
      tankerReference?: string;
      arrivedAt?: string;
      purchaseDate?: string;
      notes?: string;
      lines?: Array<{
        fuelId?: string;
        quantityFuusto?: string;
        actualLiters?: string;
        expectedLiters?: string;
        unitPurchaseCost?: string;
        totalPurchaseCost?: string;
      }>;
    }
  ) {
    const actor = requireActor(request);
    const arrival = body.purchaseDate || body.arrivedAt;
    if (!arrival || !body.lines?.length) throw new BadRequestException("arrivedAt/purchaseDate and at least one line are required");

    const lines = body.lines.map((line) => {
      if (!line.fuelId) throw new BadRequestException("Each receipt line needs fuelId");
      if (!line.quantityFuusto && !line.actualLiters) throw new BadRequestException("Each line requires quantityFuusto or actualLiters");

      let quantityFuustoDec: Prisma.Decimal;
      let actualLitersDec: Prisma.Decimal;
      const litersPerFuustoDec = dec("240.000000");

      if (line.quantityFuusto) {
        quantityFuustoDec = positive(line.quantityFuusto, "quantityFuusto");
        if (!quantityFuustoDec.isInteger()) throw new BadRequestException("Stock purchase quantityFuusto must be a whole number");
        actualLitersDec = quantityFuustoDec.mul(litersPerFuustoDec);
      } else {
        actualLitersDec = positive(line.actualLiters!, "actualLiters");
        quantityFuustoDec = actualLitersDec.div(litersPerFuustoDec);
        if (!quantityFuustoDec.isInteger()) throw new BadRequestException("Stock purchases must be whole fuusto containers of 240 liters");
      }

      let unitPurchaseCostDec: Prisma.Decimal | undefined;
      let totalPurchaseCostDec: Prisma.Decimal | undefined;

      if (actor.role === "OWNER") {
        if (line.unitPurchaseCost && line.unitPurchaseCost.trim() !== "") {
          unitPurchaseCostDec = positive(line.unitPurchaseCost, "unitPurchaseCost");
          totalPurchaseCostDec = line.totalPurchaseCost && line.totalPurchaseCost.trim() !== "" ? positive(line.totalPurchaseCost, "totalPurchaseCost") : unitPurchaseCostDec.mul(quantityFuustoDec);
        } else if (line.totalPurchaseCost && line.totalPurchaseCost.trim() !== "") {
          totalPurchaseCostDec = positive(line.totalPurchaseCost, "totalPurchaseCost");
          unitPurchaseCostDec = totalPurchaseCostDec.div(quantityFuustoDec);
        }
      }

      return {
        fuelId: line.fuelId,
        quantityFuusto: quantityFuustoDec,
        litersPerFuustoSnapshot: litersPerFuustoDec,
        actualLiters: actualLitersDec,
        expectedLiters: line.expectedLiters ? positive(line.expectedLiters, "expectedLiters") : actualLitersDec,
        unitPurchaseCost: unitPurchaseCostDec,
        totalPurchaseCost: totalPurchaseCostDec
      };
    });

    const row = await this.prisma.tankerReceipt.create({
      data: {
        receiptNo: documentNo("REC"),
        tankerReference: body.supplier || body.tankerReference,
        arrivedAt: new Date(arrival),
        notes: body.notes,
        createdById: actor.id,
        lines: { create: lines }
      },
      include: { lines: true }
    });
    return { data: row };
  }

  @UseGuards(SessionGuard)
  @Post(["stock/receipts/:id/post", "tanker-receipts/:id/post"])
  async postReceipt(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") headerKey?: string) {
    const actor = requireActor(request);
    const key = requireIdempotencyKey(headerKey);
    const row = await this.prisma.tankerReceipt.findUnique({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundException("Stock receipt not found");
    if (row.status === "POSTED") return { data: { id: row.id, status: row.status, replay: true } };
    if (row.status !== "DRAFT") throw new BadRequestException("Only draft receipts can be posted");

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.tankerReceipt.updateMany({ where: { id, status: "DRAFT" }, data: { status: "POSTED", postedById: actor.id, postedAt: new Date(), postIdempotencyKey: key } });
      if (claimed.count !== 1) throw new BadRequestException("Receipt was already posted");

      for (const line of row.lines) {
        await tx.inventoryMovement.create({
          data: {
            fuelId: line.fuelId,
            location: "WAREHOUSE",
            signedDeltaLiters: line.actualLiters,
            eventType: "RECEIPT",
            sourceType: "TankerReceiptLine",
            sourceId: row.id,
            sourceLineId: line.id,
            createdById: actor.id
          }
        });
        await tx.stockBalance.update({
          where: { fuelId_location: { fuelId: line.fuelId, location: "WAREHOUSE" } },
          data: { balanceLiters: { increment: line.actualLiters }, version: { increment: 1 } }
        });
      }

      await tx.auditEvent.create({
        data: { actorId: actor.id, entityType: "TankerReceipt", entityId: id, action: "POSTED" }
      });
    });

    return { data: { id, status: "POSTED" } };
  }

  @UseGuards(SessionGuard)
  @Get("customers")
  async customers(
    @Query("search") search?: string,
    @Query("status") status?: "ACTIVE" | "HOLD" | "INACTIVE",
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string
  ) {
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      ...(status ? { status } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { name: { contains: search.trim(), mode: "insensitive" } },
              { code: { contains: search.trim(), mode: "insensitive" } },
              { primaryPhone: { contains: search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: { addresses: true },
        orderBy: { name: "asc" },
        skip,
        take: limit
      }),
      this.prisma.customer.count({ where })
    ]);

    const debts = await this.prisma.invoice.groupBy({ by: ["customerId"], where: { customerId: { in: items.map(item => item.id) }, status: { in: ["UNPAID", "PARTIALLY_PAID"] } }, _sum: { balanceDue: true } });
    const debtByCustomer = new Map(debts.map(row => [row.customerId, row._sum.balanceDue?.toFixed(4) ?? "0.0000"]));

    return {
      data: {
        items: items.map(item => ({ ...item, outstandingDebt: debtByCustomer.get(item.id) ?? "0.0000" })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("customers")
  async createCustomer(@Req() request: AuthenticatedRequest, @Body() body: { name?: string; primaryPhone?: string; address?: string; district?: string; city?: string; notes?: string }) {
    const actor = requireActor(request);
    if (!body.name?.trim()) throw new BadRequestException("name is required");
    const row = await this.prisma.customer.create({
      data: {
        code: documentNo("CUS"),
        name: body.name.trim(),
        primaryPhone: body.primaryPhone?.trim() || null,
        notes: body.notes?.trim() || null,
        createdById: actor.id,
        addresses: body.address?.trim()
          ? {
              create: {
                label: "Primary",
                addressText: body.address.trim(),
                district: body.district?.trim() || null,
                city: body.city?.trim() || null,
                isDefault: true
              }
            }
          : undefined
      },
      include: { addresses: true }
    });
    return { data: row };
  }

  @UseGuards(SessionGuard)
  @Get("customers/:id")
  async customer(@Param("id") id: string) { const row = await this.prisma.customer.findUnique({ where: { id }, include: { addresses: true, orders: { include: { lines: { include: { fuel: true } } }, orderBy: { orderDate: "desc" } } } }); if (!row) throw new NotFoundException("Customer not found"); return { data: row }; }

  @UseGuards(SessionGuard)
  @Patch("customers/:id")
  async updateCustomer(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: { name?: string; primaryPhone?: string; status?: "ACTIVE" | "HOLD" | "INACTIVE"; notes?: string; address?: string }) {
    const actor = requireActor(request);
    const existing = await this.prisma.customer.findUnique({ where: { id }, include: { addresses: true } });
    if (!existing) throw new NotFoundException("Customer not found");
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name: body.name?.trim() || undefined,
          primaryPhone: body.primaryPhone !== undefined ? (body.primaryPhone?.trim() || null) : undefined,
          status: body.status || undefined,
          notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined
        },
        include: { addresses: true }
      });
      if (body.address?.trim()) {
        const defaultAddr = existing.addresses.find((a) => a.isDefault) || existing.addresses[0];
        if (defaultAddr) {
          await tx.customerAddress.update({ where: { id: defaultAddr.id }, data: { addressText: body.address.trim() } });
        } else {
          await tx.customerAddress.create({ data: { customerId: id, label: "Primary", addressText: body.address.trim(), isDefault: true } });
        }
      }
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "Customer",
          entityId: id,
          action: "UPDATED",
          beforeRedacted: { name: existing.name, primaryPhone: existing.primaryPhone, status: existing.status },
          afterRedacted: { name: updated.name, primaryPhone: updated.primaryPhone, status: updated.status }
        }
      });
      return tx.customer.findUniqueOrThrow({ where: { id }, include: { addresses: true } });
    });
    return { data: row };
  }

  @UseGuards(SessionGuard)
  @Post("orders")
  async createOrder(
    @Req() request: AuthenticatedRequest,
    @Body() body: {
      customerId?: string;
      addressSnapshot?: string;
      requestedDeliveryDate?: string;
      notes?: string;
      fixedDiscountAmount?: string;
      discountReason?: string;
      lines?: Array<{ fuelId?: string; salesUnitId?: string; requestedUnits?: string }>;
    }
  ) {
    const actor = requireActor(request);
    if (!body.customerId || !body.addressSnapshot || !body.lines?.length) {
      throw new BadRequestException("customerId, addressSnapshot and lines are required");
    }

    const fixedDiscount = body.fixedDiscountAmount ? dec(body.fixedDiscountAmount) : dec("0");
    if (fixedDiscount.lt(0)) {
      throw new BadRequestException("Fixed discount amount cannot be negative");
    }

    const isOwner = actor.role === "OWNER";
    const discountApprovedById = fixedDiscount.gt(0) && isOwner ? actor.id : null;
    const discountApprovedAt = fixedDiscount.gt(0) && isOwner ? new Date() : null;

    const lines = body.lines.map((line) => {
      if (!line.fuelId || !line.salesUnitId || !line.requestedUnits) {
        throw new BadRequestException("Each order line needs fuelId, salesUnitId and requestedUnits");
      }
      return { fuelId: line.fuelId, salesUnitId: line.salesUnitId, requestedUnits: positive(line.requestedUnits, "requestedUnits") };
    });

    const row = await this.prisma.salesOrder.create({
      data: {
        orderNo: documentNo("SO"),
        customerId: body.customerId,
        addressSnapshot: body.addressSnapshot,
        requestedDeliveryDate: body.requestedDeliveryDate ? localDate(body.requestedDeliveryDate) : undefined,
        orderDate: new Date(),
        notes: body.notes,
        fixedDiscountAmount: fixedDiscount,
        discountReason: body.discountReason,
        discountApprovedById,
        discountApprovedAt,
        createdById: actor.id,
        lines: { create: lines }
      },
      include: { lines: true, discountApprovedBy: { select: { displayName: true } } }
    });

    if (fixedDiscount.gt(0)) {
      await this.prisma.orderEvent.create({
        data: {
          orderId: row.id,
          kind: discountApprovedById ? "DISCOUNT_APPROVED" : "DISCOUNT_REQUESTED",
          newValues: { fixedDiscountAmount: fixedDiscount.toFixed(4), discountReason: body.discountReason },
          actorId: actor.id
        }
      });
    }

    return {
      data: {
        ...row,
        subtotal: jsonDecimal(row.subtotal),
        fixedDiscountAmount: row.fixedDiscountAmount.toFixed(4),
        totalAmount: jsonDecimal(row.totalAmount),
        discountApprovedByName: row.discountApprovedBy?.displayName ?? null
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("orders")
  async orders(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string,
    @Query("date") date?: string
  ) {
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      ...(date ? { orderDate: { gte: new Date(`${localDate(date).toISOString().slice(0, 10)}T00:00:00+03:00`), lt: new Date(new Date(`${date}T00:00:00+03:00`).getTime() + 86400000) } } : {}),
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as Prisma.EnumOrderStatusFilter } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { orderNo: { contains: search.trim(), mode: "insensitive" } },
              { customer: { name: { contains: search.trim(), mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: { customer: true, discountApprovedBy: { select: { displayName: true } }, payments: { where: { status: "POSTED" } }, lines: { include: { fuel: true, salesUnit: true, invoiceLines: { include: { invoice: { include: { allocations: { include: { payment: true } } } } } } } } },
        orderBy: { orderDate: "desc" },
        skip,
        take: limit
      }),
      this.prisma.salesOrder.count({ where })
    ]);

    return {
      data: {
        items: rows.map((row) => ({
          ...row,
          subtotal: jsonDecimal(row.subtotal),
          fixedDiscountAmount: row.fixedDiscountAmount.toFixed(4),
          totalAmount: jsonDecimal(row.totalAmount),
          paidAmount: row.payments.reduce((sum,p) => sum.add(p.amount), dec("0")).add(row.lines.flatMap(l=>l.invoiceLines).filter(il=>!["REVERSED","CANCELLED"].includes(il.invoice.status)).flatMap(il=>il.invoice.allocations).filter(a=>a.payment.status==="POSTED" && a.payment.orderId!==row.id).reduce((sum,a)=>sum.add(a.amount),dec("0"))).toFixed(4),
          invoicedBalance: row.lines.flatMap(l=>l.invoiceLines).filter(il=>["UNPAID","PARTIALLY_PAID"].includes(il.invoice.status)).reduce((sum,il)=>sum.add(il.invoice.balanceDue),dec("0")).toFixed(4),
          payments: undefined,
          discountApprovedByName: row.discountApprovedBy?.displayName ?? null,
          lines: row.lines.map((line) => ({
            ...line,
            invoiceLines: undefined,
            requestedUnits: line.requestedUnits.toFixed(3),
            requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot),
            litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot),
            unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot)
          }))
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("orders/:id")
  async order(@Param("id") id: string) {
    const row = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        discountApprovedBy: { select: { displayName: true } },
        lines: { include: { fuel: true, salesUnit: true, dispatchLines: { include: { confirmations: true } } } },
        events: { orderBy: { occurredAt: "asc" } }
      }
    });
    if (!row) throw new NotFoundException("Order not found");

    const now = new Date();
    const formattedLines = await Promise.all(
      row.lines.map(async (line) => {
        let currentActiveUnitPrice: string | null = null;
        if (row.status === "DRAFT") {
          const activePrice = await this.prisma.priceVersion.findFirst({
            where: {
              fuelId: line.fuelId,
              salesUnitId: line.salesUnitId,
              effectiveFromUtc: { lte: now },
              OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }]
            },
            orderBy: { effectiveFromUtc: "desc" }
          });
          if (activePrice) currentActiveUnitPrice = activePrice.unitPrice.toFixed(4);
        }

        return {
          ...line,
          requestedUnits: line.requestedUnits.toFixed(3),
          requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot),
          litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot),
          unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot),
          currentActiveUnitPrice,
          dispatchLines: line.dispatchLines.map((dispatchLine) => ({
            ...dispatchLine,
            dispatchedUnits: dispatchLine.dispatchedUnits.toFixed(3),
            dispatchedLiters: dispatchLine.dispatchedLiters.toFixed(3),
            confirmations: dispatchLine.confirmations.map((item) => ({
              ...item,
              acceptedUnits: item.acceptedUnits.toFixed(3),
              acceptedLiters: item.acceptedLiters.toFixed(3),
              physicalReturnedLiters: item.physicalReturnedLiters.toFixed(3)
            }))
          }))
        };
      })
    );

    return {
      data: {
        ...row,
        subtotal: jsonDecimal(row.subtotal),
        fixedDiscountAmount: row.fixedDiscountAmount.toFixed(4),
        totalAmount: jsonDecimal(row.totalAmount),
        discountApprovedByName: row.discountApprovedBy?.displayName ?? null,
        lines: formattedLines
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("orders/:id/approve-discount")
  async approveDiscount(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: { reason?: string }
  ) {
    const actor = requireOwner(request);
    const row = await this.prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundException("Order not found");
    if (row.status !== "DRAFT") throw new BadRequestException("Discount approval is only applicable to draft orders");
    if (!row.fixedDiscountAmount || row.fixedDiscountAmount.lte(0)) {
      throw new BadRequestException("Order does not have a pending discount to approve");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      let subtotal = dec("0");
      for (const line of row.lines) {
        const [unit, price] = await Promise.all([
          tx.fuelUnitVersion.findFirst({
            where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] },
            orderBy: { effectiveFromUtc: "desc" }
          }),
          tx.priceVersion.findFirst({
            where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] },
            orderBy: { effectiveFromUtc: "desc" }
          })
        ]);
        if (!unit || !unit.litersPerUnit.eq(240) || !price) throw new BadRequestException("Current price and 240 L fuusto must be configured");
        subtotal = subtotal.add(line.requestedUnits.mul(price.unitPrice));
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: {
            conversionVersionId: unit.id,
            litersPerUnitSnapshot: unit.litersPerUnit,
            requestedLitersSnapshot: line.requestedUnits.mul(unit.litersPerUnit),
            priceVersionId: price.id,
            unitPriceSnapshot: price.unitPrice,
            confirmedAt: now
          }
        });
      }
      if (row.fixedDiscountAmount.gt(subtotal)) throw new BadRequestException("Discount exceeds order total");
      const saved = await tx.salesOrder.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          subtotal,
          totalAmount: subtotal.sub(row.fixedDiscountAmount),
          confirmedAt: now,
          confirmedById: actor.id,
          discountApprovedById: actor.id,
          discountApprovedAt: now,
          discountReason: body.reason ?? row.discountReason
        },
        include: { discountApprovedBy: { select: { displayName: true } }, lines: true }
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          kind: "DISCOUNT_APPROVED",
          newValues: { status: "CONFIRMED", fixedDiscountAmount: saved.fixedDiscountAmount.toFixed(4), totalAmount: saved.totalAmount?.toFixed(4), discountApprovedById: actor.id },
          actorId: actor.id,
          reason: body.reason
        }
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "SalesOrder",
          entityId: id,
          action: "DISCOUNT_APPROVED",
          reason: body.reason
        }
      });
      return saved;
    });

    return {
      data: {
        ...updated,
        subtotal: jsonDecimal(updated.subtotal),
        fixedDiscountAmount: updated.fixedDiscountAmount.toFixed(4),
        totalAmount: jsonDecimal(updated.totalAmount),
        discountApprovedByName: updated.discountApprovedBy?.displayName ?? null
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("orders/:id/confirm")
  async confirmOrder(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") headerKey?: string) {
    const actor = requireActor(request);
    const key = requireIdempotencyKey(headerKey);
    const now = new Date();
    const row = await this.prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundException("Order not found");
    if (["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED", "FULFILLED"].includes(row.status)) {
      return { data: { id, status: row.status, replay: true } };
    }
    if (row.status !== "DRAFT") throw new BadRequestException("Only draft orders can be confirmed");

    const isOwner = actor.role === "OWNER";
    const fixedDiscount = row.fixedDiscountAmount ? row.fixedDiscountAmount : dec("0");

    let discountApprovedById = row.discountApprovedById;
    let discountApprovedAt = row.discountApprovedAt;

    if (fixedDiscount.gt(0) && !discountApprovedById) {
      if (isOwner) {
        discountApprovedById = actor.id;
        discountApprovedAt = now;
      } else {
        throw new ForbiddenException("Order fixed discount requires approval from OWNER before order confirmation.");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let orderSubtotal = dec("0");
      for (const line of row.lines) {
        const unit = await tx.fuelUnitVersion.findFirst({
          where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] },
          orderBy: { effectiveFromUtc: "desc" }
        });
        const price = await tx.priceVersion.findFirst({
          where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] },
          orderBy: { effectiveFromUtc: "desc" }
        });
        if (!unit) throw new BadRequestException("Fuusto capacity is not configured for one or more lines");
        if (!price) throw new BadRequestException("Price is not configured for one or more lines");

        const lineSubtotal = line.requestedUnits.mul(price.unitPrice);
        orderSubtotal = orderSubtotal.add(lineSubtotal);

        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: {
            conversionVersionId: unit.id,
            litersPerUnitSnapshot: unit.litersPerUnit,
            requestedLitersSnapshot: line.requestedUnits.mul(unit.litersPerUnit),
            priceVersionId: price.id,
            unitPriceSnapshot: price.unitPrice,
            confirmedAt: now
          }
        });
      }

      if (fixedDiscount.gt(orderSubtotal)) {
        throw new BadRequestException(`Fixed discount amount ($${fixedDiscount.toFixed(2)}) cannot exceed order subtotal ($${orderSubtotal.toFixed(2)})`);
      }

      const orderTotalAmount = orderSubtotal.sub(fixedDiscount);

      const claimed = await tx.salesOrder.updateMany({
        where: { id, status: "DRAFT" },
        data: {
          status: "CONFIRMED",
          confirmedAt: now,
          confirmedById: actor.id,
          confirmationIdempotencyKey: key,
          subtotal: orderSubtotal,
          totalAmount: orderTotalAmount,
          discountApprovedById,
          discountApprovedAt
        }
      });
      if (claimed.count !== 1) throw new BadRequestException("Order was already confirmed");
      const saved = await tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { lines: true, discountApprovedBy: { select: { displayName: true } } } });
      await tx.orderEvent.create({ data: { orderId: id, kind: "CONFIRMED", newValues: { status: "CONFIRMED", subtotal: orderSubtotal.toFixed(4), fixedDiscountAmount: fixedDiscount.toFixed(4), totalAmount: orderTotalAmount.toFixed(4) }, actorId: actor.id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrder", entityId: id, action: "CONFIRMED" } });
      return saved;
    });

    return {
      data: {
        ...updated,
        subtotal: updated.subtotal?.toFixed(4) ?? null,
        fixedDiscountAmount: updated.fixedDiscountAmount.toFixed(4),
        totalAmount: updated.totalAmount?.toFixed(4) ?? null,
        discountApprovedByName: updated.discountApprovedBy?.displayName ?? null,
        lines: updated.lines.map((line) => ({
          ...line,
          requestedUnits: line.requestedUnits.toFixed(3),
          requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot),
          litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot),
          unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot)
        }))
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("orders/:id/cancel")
  async cancelOrder(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: { reason?: string }) {
    const actor = requireActor(request);
    const row = await this.prisma.salesOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Order not found");
    if (["FULFILLED", "CANCELLED"].includes(row.status)) {
      throw new BadRequestException(`Cannot cancel order in status ${row.status}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.salesOrder.update({
        where: { id },
        data: { status: "CANCELLED" }
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          kind: "CANCELLED",
          newValues: { status: "CANCELLED" },
          actorId: actor.id,
          reason: body.reason
        }
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "SalesOrder",
          entityId: id,
          action: "CANCELLED",
          reason: body.reason
        }
      });
      return saved;
    });
    return { data: updated };
  }

  @UseGuards(SessionGuard)
  @Get("delivery-sheets")
  async sheets() {
    const rows = await this.prisma.deliverySheet.findMany({ include: { lines: true }, orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }], take: 100 });
    return { data: rows.map((row) => ({ id: row.id, sheetNo: row.sheetNo, serviceDate: row.serviceDate.toISOString().slice(0, 10), status: row.status, lines: row.lines.map((line) => ({ scheduledUnits: line.scheduledUnits.toFixed(3), displayCustomerNameSnapshot: line.displayCustomerNameSnapshot, fuelLabelSnapshot: line.fuelLabelSnapshot })) })) };
  }

  @UseGuards(SessionGuard)
  @Get("delivery-sheets/:id")
  async sheet(@Param("id") id: string) { const row = await this.prisma.deliverySheet.findUnique({ where: { id }, include: { lines: { include: { orderLine: { include: { order: { include: { customer: true } }, fuel: true } } } }, dispatches: { include: { lines: true } } } }); if (!row) throw new NotFoundException("Delivery sheet not found"); return { data: { ...row, serviceDate: row.serviceDate.toISOString().slice(0, 10), lines: row.lines.map((line) => ({ ...line, scheduledUnits: line.scheduledUnits.toFixed(3) })), dispatches: row.dispatches.map((dispatch) => ({ ...dispatch, lines: dispatch.lines.map((line) => ({ ...line, dispatchedUnits: line.dispatchedUnits.toFixed(3), dispatchedLiters: line.dispatchedLiters.toFixed(3), litersPerUnitSnapshot: line.litersPerUnitSnapshot.toFixed(6) })) })) } };
  }

  @UseGuards(SessionGuard)
  @Post("delivery-sheets")
  async createSheet(@Req() request: AuthenticatedRequest, @Body() body: { serviceDate?: string; orderLineIds?: string[]; instructions?: Record<string, string> }) {
    const actor = requireActor(request); if (!body.serviceDate || !body.orderLineIds?.length) throw new BadRequestException("serviceDate and orderLineIds are required"); const lines = await this.prisma.salesOrderLine.findMany({ where: { id: { in: body.orderLineIds }, order: { status: { in: ["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED"] } } }, include: { order: { include: { customer: true } }, fuel: true } }); if (lines.length !== body.orderLineIds.length) throw new BadRequestException("One or more order lines are not eligible"); const row = await this.prisma.deliverySheet.create({ data: { sheetNo: documentNo("DS"), serviceDate: localDate(body.serviceDate), createdById: actor.id, lines: { create: lines.map((line) => ({ orderLineId: line.id, scheduledUnits: line.requestedUnits, orderNoSnapshot: line.order.orderNo, displayCustomerNameSnapshot: line.order.customer.name, phoneSnapshot: line.order.customer.primaryPhone, addressSnapshot: line.order.addressSnapshot, fuelLabelSnapshot: line.fuel.displayName, instructions: body.instructions?.[line.id] })) } }, include: { lines: true } }); await this.prisma.salesOrder.updateMany({ where: { id: { in: lines.map((line) => line.orderId) }, status: "CONFIRMED" }, data: { status: "SCHEDULED" } }); return { data: row };
  }

  @UseGuards(SessionGuard)
  @Get("delivery-sheets/:id/manifest")
  async manifest(@Param("id") id: string) { const row = await this.prisma.deliverySheet.findUnique({ where: { id }, include: { lines: true } }); if (!row) throw new NotFoundException("Delivery sheet not found"); const lines = row.lines.map((line) => deliveryManifestLineSchema.parse({ orderNo: line.orderNoSnapshot, customerName: line.displayCustomerNameSnapshot, phone: line.phoneSnapshot, address: line.addressSnapshot, fuel: line.fuelLabelSnapshot.startsWith("Diesel") ? "DIESEL" : "PETROL", scheduledUnits: line.scheduledUnits.toFixed(3), instructions: line.instructions })); return { data: { sheetNo: row.sheetNo, serviceDate: row.serviceDate.toISOString().slice(0, 10), lines } }; }

  @UseGuards(SessionGuard)
  @Get("delivery-sheets/:id/pdf")
  async manifestPdf(@Param("id") id: string, @Res() response: Response) {
    const row = await this.prisma.deliverySheet.findUnique({ where: { id }, include: { lines: true } });
    if (!row) throw new NotFoundException("Delivery sheet not found");
    const branding = await this.documentBranding();
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, info: { Title: "Daily delivery list", Author: "Fuel Wholesale System" } });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => { response.type("application/pdf").send(Buffer.concat(chunks)); });
    drawDocumentLogo(doc, branding);
    doc.fontSize(16).text("Daily Delivery List");
    doc.fontSize(10).text(`Sheet ${row.sheetNo} — ${row.serviceDate.toISOString().slice(0, 10)}`);
    doc.moveDown();
    for (const [index, line] of row.lines.entries()) {
      doc.text(`${index + 1}. ${line.orderNoSnapshot} | ${line.displayCustomerNameSnapshot} | ${line.phoneSnapshot ?? ""} | ${line.addressSnapshot} | ${line.fuelLabelSnapshot} | ${line.scheduledUnits.toFixed(3)} fuusto${line.instructions ? ` | ${line.instructions}` : ""}`);
    }
    addDocumentFooter(doc, branding);
    doc.end();
  }

  @UseGuards(SessionGuard)
  @Post("dispatches")
  async createDispatch(@Req() request: AuthenticatedRequest, @Headers("idempotency-key") headerKey: string | undefined, @Body() body: { deliverySheetId?: string; lines?: Array<{ orderLineId?: string; dispatchedUnits?: string }> }) { const actor = requireActor(request); const key = requireIdempotencyKey(headerKey); const replay = await this.prisma.dispatch.findUnique({ where: { idempotencyKey: key }, include: { lines: true } }); if (replay) return { data: { ...replay, replay: true } }; if (!body.lines?.length) throw new BadRequestException("lines are required"); const orderLines = await this.prisma.salesOrderLine.findMany({ where: { id: { in: body.lines.map((line) => line.orderLineId).filter((id): id is string => Boolean(id)) } } }); const byId = new Map(orderLines.map((line) => [line.id, line])); const lines = body.lines.map((line) => { const source = line.orderLineId ? byId.get(line.orderLineId) : undefined; if (!source || !line.dispatchedUnits || !source.litersPerUnitSnapshot) throw new BadRequestException("Dispatch lines must reference confirmed order lines"); const units = positive(line.dispatchedUnits, "dispatchedUnits"); return { orderLineId: source.id, dispatchedUnits: units, dispatchedLiters: units.mul(source.litersPerUnitSnapshot), litersPerUnitSnapshot: source.litersPerUnitSnapshot, fuelId: source.fuelId }; }); const row = await this.prisma.dispatch.create({ data: { dispatchNo: documentNo("DP"), deliverySheetId: body.deliverySheetId, lines: { create: lines.map(({ fuelId: _fuelId, ...line }) => line) }, postedById: actor.id, idempotencyKey: key }, include: { lines: true } }); return { data: row }; }

  @UseGuards(SessionGuard)
  @Get("dispatches")
  async dispatches() { const rows = await this.prisma.dispatch.findMany({ include: { deliverySheet: true, lines: true }, orderBy: { dispatchNo: "desc" }, take: 100 }); return { data: rows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line, dispatchedUnits: line.dispatchedUnits.toFixed(3), dispatchedLiters: line.dispatchedLiters.toFixed(3) })) })) }; }

  @UseGuards(SessionGuard)
  @Get("dispatches/:id")
  async dispatch(@Param("id") id: string) { const row = await this.prisma.dispatch.findUnique({ where: { id }, include: { deliverySheet: true, lines: { include: { orderLine: { include: { order: { include: { customer: true } }, fuel: true } }, confirmations: true } }, confirmations: { include: { lines: true } } } }); if (!row) throw new NotFoundException("Dispatch not found"); return { data: { ...row, lines: row.lines.map((line) => ({ ...line, dispatchedUnits: line.dispatchedUnits.toFixed(3), dispatchedLiters: line.dispatchedLiters.toFixed(3), litersPerUnitSnapshot: line.litersPerUnitSnapshot.toFixed(6), confirmations: line.confirmations.map((item) => ({ ...item, acceptedUnits: item.acceptedUnits.toFixed(3), acceptedLiters: item.acceptedLiters.toFixed(3), physicalReturnedLiters: item.physicalReturnedLiters.toFixed(3) })) })) } };
  }

  @UseGuards(SessionGuard)
  @Get("users")
  async users(@Req() request: AuthenticatedRequest) { requireOwner(request); const rows = await this.prisma.user.findMany({ select: { id: true, displayName: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true }, orderBy: { displayName: "asc" } }); return { data: rows }; }

  @UseGuards(SessionGuard)
  @Post("users")
  async createUser(@Req() request: AuthenticatedRequest, @Body() body: { displayName?: string; email?: string; password?: string; role?: "OWNER" | "OFFICE_EMPLOYEE" }) { const actor = requireOwner(request); const email = body.email?.trim().toLowerCase(); if (!body.displayName?.trim() || !email || !body.password || body.password.length < 12 || !body.role) throw new BadRequestException("displayName, email, role and a 12+ character password are required"); const row = await this.prisma.$transaction(async (tx) => { const created = await tx.user.create({ data: { displayName: body.displayName!.trim(), email, passwordHash: await argon2.hash(body.password!), role: body.role! }, select: { id: true, displayName: true, email: true, role: true, isActive: true } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "User", entityId: created.id, action: "CREATED", afterRedacted: { email: created.email, role: created.role } } }); return created; }); return { data: row }; }

  @UseGuards(SessionGuard)
  @Get("settings/document-branding")
  async getDocumentBranding(@Req() request: AuthenticatedRequest) {
    requireActor(request);
    const settings = await this.prisma.documentBranding.findUnique({ where: { id: "global" } });
    return { data: { companyName: settings?.companyName ?? "FuelDesk", logoUrl: settings?.logoUrl ?? "", footerText: settings?.footerText ?? "" } };
  }

  @UseGuards(SessionGuard)
  @Patch("settings/document-branding")
  async updateDocumentBranding(
    @Req() request: AuthenticatedRequest,
    @Body() body: { companyName?: string; logoUrl?: string | null; footerText?: string | null }
  ) {
    const actor = requireOwner(request);
    const companyName = body.companyName?.trim();
    if (!companyName || companyName.length > 120 || /[\u0000-\u001f]/.test(companyName)) {
      throw new BadRequestException("Company name is required and must be 120 characters or fewer");
    }
    if (body.logoUrl !== undefined && body.logoUrl !== null && typeof body.logoUrl !== "string") {
      throw new BadRequestException("Logo URL must be text");
    }
    if (body.footerText !== undefined && body.footerText !== null && typeof body.footerText !== "string") {
      throw new BadRequestException("Footer text must be text");
    }
    const logoValue = body.logoUrl?.trim() ?? "";
    const footerValue = body.footerText?.trim() ?? "";
    if (logoValue.length > 2048) throw new BadRequestException("Logo URL must be 2048 characters or fewer");
    if (footerValue.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(footerValue)) {
      throw new BadRequestException("Footer must be 500 characters or fewer and contain printable text");
    }
    let logoUrl: string | null = null;
    if (logoValue) {
      try {
        logoUrl = validateLogoUrl(logoValue);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : "Invalid logo URL");
      }
    }
    const footerText = footerValue || null;
    const settings = await this.prisma.$transaction(async (tx) => {
      const row = await tx.documentBranding.upsert({
        where: { id: "global" },
        create: { id: "global", companyName, logoUrl, footerText, updatedById: actor.id },
        update: { companyName, logoUrl, footerText, updatedById: actor.id }
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "DocumentBranding",
          entityId: row.id,
          action: "UPDATED",
          afterRedacted: { companyName, logoConfigured: Boolean(logoUrl), footerConfigured: Boolean(footerText) }
        }
      });
      return row;
    });
    return { data: { companyName: settings.companyName, logoUrl: settings.logoUrl ?? "", footerText: settings.footerText ?? "" } };
  }

  @UseGuards(SessionGuard)
  @Post("dispatches/:id/post")
  async postDispatch(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") headerKey?: string) { const actor = requireActor(request); const key = requireIdempotencyKey(headerKey); const row = await this.prisma.dispatch.findUnique({ where: { id }, include: { lines: { include: { orderLine: true } } } }); if (!row) throw new NotFoundException("Dispatch not found"); if (row.status === "POSTED" || row.status === "PARTIALLY_RECONCILED" || row.status === "RECONCILED") return { data: { id, status: row.status, replay: true } }; await this.prisma.$transaction(async (tx) => { const claimed = await tx.dispatch.updateMany({ where: { id, status: "PREPARED" }, data: { status: "POSTED", postedAt: new Date(), postedById: actor.id, postIdempotencyKey: key } }); if (claimed.count !== 1) throw new BadRequestException("Dispatch was already posted"); for (const line of row.lines) { const changed = await tx.stockBalance.updateMany({ where: { fuelId: line.orderLine.fuelId, location: "WAREHOUSE", balanceLiters: { gte: line.dispatchedLiters } }, data: { balanceLiters: { decrement: line.dispatchedLiters }, version: { increment: 1 } } }); if (changed.count !== 1) throw new BadRequestException(`Insufficient warehouse stock for ${line.orderLine.fuelId}`); await tx.stockBalance.update({ where: { fuelId_location: { fuelId: line.orderLine.fuelId, location: "IN_TRANSIT" } }, data: { balanceLiters: { increment: line.dispatchedLiters }, version: { increment: 1 } } }); await tx.inventoryMovement.create({ data: { fuelId: line.orderLine.fuelId, location: "WAREHOUSE", signedDeltaLiters: line.dispatchedLiters.neg(), eventType: "DISPATCH", sourceType: "DispatchLine", sourceId: row.id, sourceLineId: line.id, createdById: actor.id } }); await tx.inventoryMovement.create({ data: { fuelId: line.orderLine.fuelId, location: "IN_TRANSIT", signedDeltaLiters: line.dispatchedLiters, eventType: "DISPATCH", sourceType: "DispatchLine", sourceId: row.id, sourceLineId: line.id, createdById: actor.id } }); } const orderIds = [...new Set(row.lines.map((line) => line.orderLine.orderId))]; await tx.salesOrder.updateMany({ where: { id: { in: orderIds }, status: { in: ["SCHEDULED", "CONFIRMED"] } }, data: { status: "IN_PROGRESS" } }); if (row.deliverySheetId) await tx.deliverySheet.update({ where: { id: row.deliverySheetId }, data: { status: "DISPATCHED" } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Dispatch", entityId: id, action: "POSTED" } }); }); return { data: { id, status: "POSTED" } }; }

  @UseGuards(SessionGuard)
  @Post("dispatches/:id/reconcile")
  async reconcile(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Body() body: {
      lines?: Array<{
        dispatchLineId?: string;
        acceptedUnits?: string;
        physicalReturnedLiters?: string;
        commercialDisposition?: "NONE" | "CANCEL_REMAINDER" | "BACKORDER_REMAINDER";
        discrepancyReason?: string;
      }>;
    }
  ) {
    const actor = requireActor(request);
    const key = requireIdempotencyKey(headerKey);
    const replay = await this.prisma.deliveryConfirmation.findUnique({ where: { idempotencyKey: key }, include: { lines: true } });
    if (replay) return { data: { ...replay, replay: true } };
    if (!body.lines?.length) throw new BadRequestException("lines are required");
    const dispatch = await this.prisma.dispatch.findUnique({
      where: { id },
      include: { lines: { include: { orderLine: true, confirmations: true } } }
    });
    if (!dispatch) throw new NotFoundException("Dispatch not found");
    if (!["POSTED", "PARTIALLY_RECONCILED"].includes(dispatch.status)) throw new BadRequestException("Dispatch is not ready for reconciliation");
    const inputById = new Map(body.lines.map((line) => [line.dispatchLineId, line]));
    const confirmation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryConfirmation.create({
        data: {
          confirmationNo: documentNo("DC"),
          dispatchId: id,
          confirmedAt: new Date(),
          recordedById: actor.id,
          idempotencyKey: key,
          lines: {
            create: dispatch.lines.map((line) => {
              const input = inputById.get(line.id);
              if (!input || !input.acceptedUnits) throw new BadRequestException("Every dispatch line needs acceptedUnits");
              const acceptedUnits = dec(input.acceptedUnits);
              if (acceptedUnits.lt(0)) throw new BadRequestException("acceptedUnits cannot be negative");
              const acceptedLiters = acceptedUnits.mul(line.litersPerUnitSnapshot);
              const returnedLiters = input.physicalReturnedLiters ? dec(input.physicalReturnedLiters) : dec("0");
              if (returnedLiters.lt(0)) throw new BadRequestException("physicalReturnedLiters cannot be negative");
              const alreadyAccepted = line.confirmations.reduce((sum, item) => sum.add(item.acceptedLiters), dec("0"));
              const alreadyReturned = line.confirmations.reduce((sum, item) => sum.add(item.physicalReturnedLiters), dec("0"));
              if (alreadyAccepted.add(acceptedLiters).add(alreadyReturned).add(returnedLiters).gt(line.dispatchedLiters)) throw new BadRequestException("Reconciliation exceeds dispatched quantity");
              return {
                dispatchLineId: line.id,
                acceptedUnits,
                acceptedLiters,
                physicalReturnedLiters: returnedLiters,
                commercialDisposition: input.commercialDisposition ?? "NONE",
                discrepancyReason: input.discrepancyReason,
                billingSourceKey: `${id}:${line.id}:${Date.now()}`
              };
            })
          }
        },
        include: { lines: true }
      });
      let hasUnresolvedTransit = false;
      for (const line of created.lines) {
        const source = dispatch.lines.find((candidate) => candidate.id === line.dispatchLineId);
        if (!source) throw new BadRequestException("Dispatch line not found");
        const fuelId = source.orderLine.fuelId;
        const settled = source.confirmations.reduce((sum, item) => sum.add(item.acceptedLiters).add(item.physicalReturnedLiters), dec("0")).add(line.acceptedLiters).add(line.physicalReturnedLiters);
        if (settled.lt(source.dispatchedLiters)) hasUnresolvedTransit = true;
        const transitOut = line.acceptedLiters.add(line.physicalReturnedLiters);
        if (transitOut.gt(0)) {
          const transitChanged = await tx.stockBalance.updateMany({ where: { fuelId, location: "IN_TRANSIT", balanceLiters: { gte: transitOut } }, data: { balanceLiters: { decrement: transitOut }, version: { increment: 1 } } });
          if (transitChanged.count !== 1) throw new BadRequestException("Reconciliation exceeds in-transit stock");
          if (line.acceptedLiters.gt(0)) await tx.inventoryMovement.create({ data: { fuelId, location: "IN_TRANSIT", signedDeltaLiters: line.acceptedLiters.neg(), eventType: "ACCEPTED", sourceType: "DeliveryConfirmationLine", sourceId: created.id, sourceLineId: line.id, createdById: actor.id } });
          if (line.physicalReturnedLiters.gt(0)) {
            await tx.stockBalance.update({ where: { fuelId_location: { fuelId, location: "WAREHOUSE" } }, data: { balanceLiters: { increment: line.physicalReturnedLiters }, version: { increment: 1 } } });
            await tx.inventoryMovement.create({ data: { fuelId, location: "IN_TRANSIT", signedDeltaLiters: line.physicalReturnedLiters.neg(), eventType: "RETURN", sourceType: "DeliveryConfirmationLine", sourceId: created.id, sourceLineId: line.id, createdById: actor.id } });
            await tx.inventoryMovement.create({ data: { fuelId, location: "WAREHOUSE", signedDeltaLiters: line.physicalReturnedLiters, eventType: "RETURN", sourceType: "DeliveryConfirmationLine", sourceId: created.id, sourceLineId: line.id, createdById: actor.id } });
          }
        }
      }
      const dispatchStatus = hasUnresolvedTransit ? "PARTIALLY_RECONCILED" : "RECONCILED";
      await tx.dispatch.update({ where: { id }, data: { status: dispatchStatus } });
      if (dispatch.deliverySheetId) await tx.deliverySheet.update({ where: { id: dispatch.deliverySheetId }, data: { status: dispatchStatus } });
      const orderIds = [...new Set(dispatch.lines.map((line) => line.orderLine.orderId))];
      for (const orderId of orderIds) {
        const orderLines = await tx.salesOrderLine.findMany({ where: { orderId }, include: { dispatchLines: { include: { confirmations: true } } } });
        const acceptedByLine = orderLines.map((orderLine) => orderLine.dispatchLines.flatMap((dispatchLine) => dispatchLine.confirmations).reduce((sum, item) => sum.add(item.acceptedLiters), dec("0")));
        const allFulfilled = orderLines.every((orderLine, index) => Boolean(orderLine.requestedLitersSnapshot) && acceptedByLine[index]!.gte(orderLine.requestedLitersSnapshot!));
        const anyAccepted = acceptedByLine.some((value) => value.gt(0));
        const orderStatus = allFulfilled ? "FULFILLED" : anyAccepted ? "PARTIALLY_FULFILLED" : "IN_PROGRESS";
        await tx.salesOrder.update({ where: { id: orderId }, data: { status: orderStatus } });
        await tx.orderEvent.create({ data: { orderId, kind: "DELIVERY_RECONCILED", newValues: { status: orderStatus, dispatchId: id }, actorId: actor.id } });
      }
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "DeliveryConfirmation", entityId: created.id, action: "POSTED" } });
      return created;
    });
    return { data: confirmation };
  }

  @UseGuards(SessionGuard)
  @Get("invoices/unbilled")
  async unbilledDeliveries() {
    const lines = await this.prisma.deliveryConfirmationLine.findMany({
      where: { invoice: null, acceptedUnits: { gt: new Prisma.Decimal("0") } },
      include: {
        confirmation: { include: { recordedBy: true } },
        dispatchLine: {
          include: {
            orderLine: { include: { order: { include: { customer: true } }, fuel: true, salesUnit: true } }
          }
        }
      },
      orderBy: { confirmation: { confirmedAt: "desc" } }
    });
    return {
      data: lines.map((line) => ({
        id: line.id,
        billingSourceKey: line.billingSourceKey,
        confirmedAt: line.confirmation.confirmedAt,
        customerName: line.dispatchLine.orderLine.order.customer.name,
        customerId: line.dispatchLine.orderLine.order.customerId,
        orderNo: line.dispatchLine.orderLine.order.orderNo,
        fuel: line.dispatchLine.orderLine.fuel.displayName,
        salesUnit: line.dispatchLine.orderLine.salesUnit.name,
        acceptedUnits: line.acceptedUnits.toFixed(3),
        acceptedLiters: line.acceptedLiters.toFixed(3),
        unitPriceSnapshot: jsonDecimal(line.dispatchLine.orderLine.unitPriceSnapshot),
        litersPerUnitSnapshot: jsonDecimal(line.dispatchLine.orderLine.litersPerUnitSnapshot),
        estimatedTotal: line.dispatchLine.orderLine.unitPriceSnapshot
          ? line.acceptedUnits.mul(line.dispatchLine.orderLine.unitPriceSnapshot).toFixed(4)
          : null
      }))
    };
  }

  @UseGuards(SessionGuard)
  @Post("invoices")
  async createInvoice(
    @Req() request: AuthenticatedRequest,
    @Body() body: { deliveryConfirmationLineId?: string; dispatchId?: string; dueDate?: string; notes?: string }
  ) {
    const actor = requireActor(request);
    let targetLineIds: string[] = [];
    if (body.deliveryConfirmationLineId) {
      targetLineIds = [body.deliveryConfirmationLineId];
    } else if (body.dispatchId) {
      const confirmations = await this.prisma.deliveryConfirmationLine.findMany({
        where: { confirmation: { dispatchId: body.dispatchId }, invoice: null, acceptedUnits: { gt: new Prisma.Decimal("0") } }
      });
      targetLineIds = confirmations.map((c) => c.id);
    }
    if (!targetLineIds.length) throw new BadRequestException("deliveryConfirmationLineId or dispatchId with unbilled accepted fuel is required");

    const createdInvoices = [];

    for (const confirmationLineId of targetLineIds) {
      const line = await this.prisma.deliveryConfirmationLine.findUnique({
        where: { id: confirmationLineId },
        include: {
          invoice: true,
          dispatchLine: {
            include: {
              orderLine: { include: { order: { include: { customer: true } }, fuel: true, salesUnit: true } }
            }
          }
        }
      });

      if (!line) throw new NotFoundException(`Delivery confirmation line ${confirmationLineId} not found`);
      if (line.invoice) throw new BadRequestException(`Delivery confirmation line ${confirmationLineId} is already invoiced`);
      const orderLine = line.dispatchLine.orderLine;
      if (!orderLine.unitPriceSnapshot || !orderLine.litersPerUnitSnapshot) {
        throw new BadRequestException("Order line is missing price or conversion snapshots");
      }

      const lineTotal = line.acceptedUnits.mul(orderLine.unitPriceSnapshot);
      const invoiceNo = documentNo("INV");

      const invoice = await this.prisma.$transaction(async (tx) => {
        const salesOrder = await tx.salesOrder.findUniqueOrThrow({ where: { id: orderLine.orderId } });
        const orderFixedDiscount = salesOrder.fixedDiscountAmount ?? dec("0");
        let invoiceDiscount = dec("0");

        if (orderFixedDiscount.gt(0)) {
          const previousInvoices = await tx.invoice.findMany({
            where: {
              lines: {
                some: {
                  orderLine: { orderId: salesOrder.id }
                }
              }
            }
          });
          const alreadyAppliedDiscount = previousInvoices.reduce((sum, inv) => sum.add(inv.discountAmount), dec("0"));
          const rem = orderFixedDiscount.sub(alreadyAppliedDiscount);
          const remainingOrderDiscount = rem.gt(0) ? rem : dec("0");

          const requestedUnits = orderLine.requestedUnits;
          const ratio = requestedUnits.gt(0) ? line.acceptedUnits.div(requestedUnits) : dec("1");
          let allocatedDiscount = orderFixedDiscount.mul(ratio);
          if (allocatedDiscount.gt(remainingOrderDiscount)) allocatedDiscount = remainingOrderDiscount;
          if (allocatedDiscount.gt(lineTotal)) allocatedDiscount = lineTotal;
          invoiceDiscount = allocatedDiscount;
        }

        const invoiceSubtotal = lineTotal;
        const invoiceTotalAmount = lineTotal.sub(invoiceDiscount);

        const inv = await tx.invoice.create({
          data: {
            invoiceNo,
            customerId: orderLine.order.customerId,
            deliveryConfirmationLineId: line.id,
            billingSourceKey: line.billingSourceKey,
            issueDate: new Date(),
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            status: "UNPAID",
            subtotal: invoiceSubtotal,
            discountAmount: invoiceDiscount,
            taxAmount: dec("0"),
            totalAmount: invoiceTotalAmount,
            paidAmount: dec("0"),
            balanceDue: invoiceTotalAmount,
            currencyCode: orderLine.currencyCode || "USD",
            notes: body.notes,
            createdById: actor.id,
            lines: {
              create: [
                {
                  orderLineId: orderLine.id,
                  fuelId: orderLine.fuelId,
                  salesUnitId: orderLine.salesUnitId,
                  acceptedUnits: line.acceptedUnits,
                  acceptedLiters: line.acceptedLiters,
                  unitPriceSnapshot: orderLine.unitPriceSnapshot!,
                  litersPerUnitSnapshot: orderLine.litersPerUnitSnapshot!,
                  lineTotal
                }
              ]
            }
          },
          include: { customer: true, lines: { include: { fuel: true, salesUnit: true } } }
        });

        // Update Subledger using net invoice totalAmount
        const lastEntry = await tx.customerLedgerEntry.findFirst({
          where: { customerId: orderLine.order.customerId },
          orderBy: { occurredAt: "desc" }
        });
        const prevBalance = lastEntry ? lastEntry.runningBalance : dec("0");
        const runningBalance = prevBalance.add(invoiceTotalAmount);
        await tx.customerLedgerEntry.create({
          data: {
            customerId: orderLine.order.customerId,
            entryType: "INVOICE",
            referenceNo: inv.invoiceNo,
            debitAmount: invoiceTotalAmount,
            creditAmount: dec("0"),
            runningBalance,
            sourceType: "Invoice",
            sourceId: inv.id,
            notes: `Invoice for ${inv.invoiceNo}`
          }
        });

        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            entityType: "Invoice",
            entityId: inv.id,
            action: "POSTED",
            afterRedacted: { invoiceNo: inv.invoiceNo, totalAmount: inv.totalAmount.toFixed(4) }
          }
        });

        return inv;
      });

      createdInvoices.push(invoice);
    }

    return {
      data: createdInvoices.map((inv) => ({
        ...inv,
        subtotal: inv.subtotal.toFixed(4),
        discountAmount: inv.discountAmount.toFixed(4),
        taxAmount: inv.taxAmount.toFixed(4),
        totalAmount: inv.totalAmount.toFixed(4),
        paidAmount: inv.paidAmount.toFixed(4),
        balanceDue: inv.balanceDue.toFixed(4),
        lines: inv.lines.map((l) => ({
          ...l,
          acceptedUnits: l.acceptedUnits.toFixed(3),
          acceptedLiters: l.acceptedLiters.toFixed(3),
          unitPriceSnapshot: l.unitPriceSnapshot.toFixed(4),
          litersPerUnitSnapshot: l.litersPerUnitSnapshot.toFixed(6),
          lineTotal: l.lineTotal.toFixed(4)
        }))
      }))
    };
  }

  @UseGuards(SessionGuard)
  @Get("invoices")
  async invoices(
    @Query("search") search?: string,
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string
  ) {
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status: status as Prisma.EnumInvoiceStatusFilter } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { invoiceNo: { contains: search.trim(), mode: "insensitive" } },
              { customer: { name: { contains: search.trim(), mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, lines: { include: { fuel: true, salesUnit: true } } },
        orderBy: { issueDate: "desc" },
        skip,
        take: limit
      }),
      this.prisma.invoice.count({ where })
    ]);

    return {
      data: {
        items: rows.map((inv) => ({
          ...inv,
          subtotal: inv.subtotal.toFixed(4),
          discountAmount: inv.discountAmount.toFixed(4),
          taxAmount: inv.taxAmount.toFixed(4),
          totalAmount: inv.totalAmount.toFixed(4),
          paidAmount: inv.paidAmount.toFixed(4),
          balanceDue: inv.balanceDue.toFixed(4),
          lines: inv.lines.map((l) => ({
            ...l,
            acceptedUnits: l.acceptedUnits.toFixed(3),
            acceptedLiters: l.acceptedLiters.toFixed(3),
            unitPriceSnapshot: l.unitPriceSnapshot.toFixed(4),
            litersPerUnitSnapshot: l.litersPerUnitSnapshot.toFixed(6),
            lineTotal: l.lineTotal.toFixed(4)
          }))
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("invoices/:id")
  async invoice(@Param("id") id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        createdBy: true,
        lines: { include: { fuel: true, salesUnit: true } },
        allocations: { include: { payment: true, createdBy: true } }
      }
    });
    if (!inv) throw new NotFoundException("Invoice not found");

    return {
      data: {
        ...inv,
        subtotal: inv.subtotal.toFixed(4),
        discountAmount: inv.discountAmount.toFixed(4),
        taxAmount: inv.taxAmount.toFixed(4),
        totalAmount: inv.totalAmount.toFixed(4),
        paidAmount: inv.paidAmount.toFixed(4),
        balanceDue: inv.balanceDue.toFixed(4),
        lines: inv.lines.map((l) => ({
          ...l,
          acceptedUnits: l.acceptedUnits.toFixed(3),
          acceptedLiters: l.acceptedLiters.toFixed(3),
          unitPriceSnapshot: l.unitPriceSnapshot.toFixed(4),
          litersPerUnitSnapshot: l.litersPerUnitSnapshot.toFixed(6),
          lineTotal: l.lineTotal.toFixed(4)
        })),
        allocations: inv.allocations.map((a) => ({
          ...a,
          amount: a.amount.toFixed(4),
          payment: {
            ...a.payment,
            amount: a.payment.amount.toFixed(4),
            unappliedAmount: a.payment.unappliedAmount.toFixed(4)
          }
        }))
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("invoices/:id/pdf")
  async invoicePdf(@Param("id") id: string, @Res() response: Response) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: { include: { addresses: true } }, lines: { include: { fuel: true, salesUnit: true } } }
    });
    if (!inv) throw new NotFoundException("Invoice not found");

    const branding = await this.documentBranding();
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, info: { Title: `Invoice ${inv.invoiceNo}`, Author: "Fuel Wholesale System" } });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      response.type("application/pdf").send(Buffer.concat(chunks));
    });

    drawDocumentLogo(doc, branding);
    doc.fontSize(18).text("COMMERCIAL INVOICE", { align: "right" });
    doc.fontSize(10).text(`Invoice No: ${inv.invoiceNo}`, { align: "right" });
    doc.text(`Issue Date: ${inv.issueDate.toISOString().slice(0, 10)}`, { align: "right" });
    if (inv.dueDate) doc.text(`Due Date: ${inv.dueDate.toISOString().slice(0, 10)}`, { align: "right" });
    doc.moveDown();

    doc.fontSize(12).text("Billed To:", { underline: true });
    doc.fontSize(10).text(inv.customer.name);
    if (inv.customer.primaryPhone) doc.text(`Phone: ${inv.customer.primaryPhone}`);
    if (inv.customer.addresses[0]) doc.text(`Address: ${inv.customer.addresses[0].addressText}`);
    doc.moveDown();

    doc.fontSize(11).text("Items / Delivered Fuel:");
    doc.text("------------------------------------------------------------------");
    for (const [idx, line] of inv.lines.entries()) {
      doc.text(
        `${idx + 1}. ${line.fuel.displayName} (${line.salesUnit.name}) | ${line.acceptedUnits.toFixed(3)} units @ $${line.unitPriceSnapshot.toFixed(4)} = $${line.lineTotal.toFixed(4)}`
      );
    }
    doc.text("------------------------------------------------------------------");
    doc.fontSize(11).text(`Subtotal: $${inv.subtotal.toFixed(4)}`);
    if (inv.discountAmount && inv.discountAmount.gt(0)) {
      doc.fontSize(11).text(`Fixed Order Discount: -$${inv.discountAmount.toFixed(4)}`);
    }
    doc.text(`Tax: $${inv.taxAmount.toFixed(4)}`);
    doc.fontSize(12).text(`Total Amount: $${inv.totalAmount.toFixed(4)}`);
    doc.text(`Amount Paid: $${inv.paidAmount.toFixed(4)}`);
    doc.text(`Balance Due: $${inv.balanceDue.toFixed(4)}`);
    doc.moveDown();
    doc.fontSize(10).text(`Status: ${inv.status}`);

    addDocumentFooter(doc, branding);
    doc.end();
  }

  @UseGuards(SessionGuard)
  @Post("invoices/:id/reverse")
  async reverseInvoice(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: { reason?: string }) {
    const actor = requireOwner(request);
    if (!body.reason?.trim()) throw new BadRequestException("Reason is required for invoice reversal");

    const inv = await this.prisma.invoice.findUnique({ where: { id }, include: { allocations: true } });
    if (!inv) throw new NotFoundException("Invoice not found");
    if (inv.status === "REVERSED") throw new BadRequestException("Invoice is already reversed");
    if (inv.allocations.length > 0 && inv.paidAmount.gt(0)) {
      throw new BadRequestException("Cannot reverse an invoice with active payment allocations. Reverse payments first.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const reversed = await tx.invoice.update({
        where: { id },
        data: { status: "REVERSED", balanceDue: dec("0") }
      });

      // Post Reversal Ledger Entry (reduces debt)
      const lastEntry = await tx.customerLedgerEntry.findFirst({ where: { customerId: inv.customerId }, orderBy: { occurredAt: "desc" } });
      const prevBalance = lastEntry ? lastEntry.runningBalance : dec("0");
      const runningBalance = prevBalance.sub(inv.totalAmount);
      await tx.customerLedgerEntry.create({
        data: {
          customerId: inv.customerId,
          entryType: "REVERSAL",
          referenceNo: `REV-${inv.invoiceNo}`,
          debitAmount: dec("0"),
          creditAmount: inv.totalAmount,
          runningBalance,
          sourceType: "InvoiceReversal",
          sourceId: inv.id,
          notes: body.reason
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "Invoice",
          entityId: inv.id,
          action: "REVERSED",
          reason: body.reason
        }
      });

      return reversed;
    });

    return {
      data: {
        ...updated,
        subtotal: updated.subtotal.toFixed(4),
        totalAmount: updated.totalAmount.toFixed(4),
        paidAmount: updated.paidAmount.toFixed(4),
        balanceDue: updated.balanceDue.toFixed(4)
      }
    };
  }

  @UseGuards(SessionGuard)
  @Post("payments")
  async createPayment(
    @Req() request: AuthenticatedRequest,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Body() body: {
      customerId?: string;
      amount?: string;
      paymentDate?: string;
      paymentMethod?: "CASH" | "BANK_TRANSFER" | "EVC_PLUS" | "EDAHAB" | "OTHER";
      reference?: string;
      notes?: string;
      allocations?: Array<{ invoiceId?: string; amount?: string }>;
    }
  ) {
    const actor = requireActor(request);
    if (body.allocations?.length) throw new BadRequestException("Payments are assigned automatically to the oldest debt");
    if (!body.customerId || !body.amount) throw new BadRequestException("Customer and amount are required");
    const result = await this.simpleWorkflows.payment(actor, headerKey, {
      customerId: body.customerId,
      amount: body.amount,
      paymentDate: body.paymentDate,
      method: body.paymentMethod,
      reference: body.reference,
      notes: body.notes
    });
    const saved = await this.prisma.payment.findUniqueOrThrow({
      where: { id: String(result.id) },
      include: { customer: true, recordedBy: true }
    });
    return {
      data: {
        id: saved.id,
        paymentNo: saved.paymentNo,
        customer: saved.customer,
        paymentDate: saved.paymentDate,
        paymentMethod: saved.paymentMethod,
        reference: saved.reference,
        amount: saved.amount.toFixed(4),
        status: saved.status,
        recordedBy: saved.recordedBy,
        replay: Boolean(result.replay)
      }
    };
  }
  @UseGuards(SessionGuard)
  @Get("payments")
  async payments(
    @Query("search") search?: string,
    @Query("customerId") customerId?: string,
    @Query("paymentMethod") paymentMethod?: string,
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string
  ) {
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(paymentMethod ? { paymentMethod: paymentMethod as Prisma.EnumPaymentMethodFilter } : {}),
      ...(search?.trim()
        ? {
            OR: [
              { paymentNo: { contains: search.trim(), mode: "insensitive" } },
              { reference: { contains: search.trim(), mode: "insensitive" } },
              { customer: { name: { contains: search.trim(), mode: "insensitive" } } }
            ]
          }
        : {})
    };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { customer: true, recordedBy: true, allocations: { include: { invoice: true } } },
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit
      }),
      this.prisma.payment.count({ where })
    ]);

    return {
      data: {
        items: rows.map((p) => ({
          ...p,
          amount: p.amount.toFixed(4),
          allocatedAmount: p.allocatedAmount.toFixed(4),
          unappliedAmount: p.unappliedAmount.toFixed(4),
          allocations: p.allocations.map((a) => ({
            ...a,
            amount: a.amount.toFixed(4)
          }))
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("payments/:id")
  async payment(@Param("id") id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        recordedBy: true,
        allocations: { include: { invoice: true } },
        reversals: { include: { reversedBy: true } }
      }
    });
    if (!p) throw new NotFoundException("Payment not found");

    return {
      data: {
        ...p,
        amount: p.amount.toFixed(4),
        allocatedAmount: p.allocatedAmount.toFixed(4),
        unappliedAmount: p.unappliedAmount.toFixed(4),
        allocations: p.allocations.map((a) => ({
          ...a,
          amount: a.amount.toFixed(4),
          invoice: {
            ...a.invoice,
            totalAmount: a.invoice.totalAmount.toFixed(4),
            paidAmount: a.invoice.paidAmount.toFixed(4),
            balanceDue: a.invoice.balanceDue.toFixed(4)
          }
        }))
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("payments/:id/receipt-pdf")
  async paymentReceiptPdf(@Param("id") id: string, @Res() response: Response) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: { customer: true, recordedBy: true, allocations: { include: { invoice: true } } }
    });
    if (!p) throw new NotFoundException("Payment not found");

    const branding = await this.documentBranding();
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ autoFirstPage: true, bufferPages: true, info: { Title: `Payment Receipt ${p.paymentNo}`, Author: "Fuel Wholesale System" } });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      response.type("application/pdf").send(Buffer.concat(chunks));
    });

    drawDocumentLogo(doc, branding);
    doc.fontSize(18).text("OFFICIAL PAYMENT RECEIPT", { align: "right" });
    doc.fontSize(10).text(`Receipt No: ${p.paymentNo}`, { align: "right" });
    doc.text(`Date: ${p.paymentDate.toISOString().slice(0, 10)}`, { align: "right" });
    doc.moveDown();

    doc.fontSize(12).text("Received From:", { underline: true });
    doc.fontSize(10).text(p.customer.name);
    doc.text(`Payment Method: ${p.paymentMethod}`);
    if (p.reference) doc.text(`Reference: ${p.reference}`);
    doc.text(`Collected By: ${p.recordedBy.displayName}`);
    doc.moveDown();

    doc.fontSize(14).text(`Amount Received: $${p.amount.toFixed(2)}`);
    doc.moveDown();

    if (p.allocations.length) {
      doc.fontSize(11).text("Paid Toward Delivered Orders:");
      doc.text("------------------------------------------------------------------");
      for (const [idx, alloc] of p.allocations.entries()) {
        doc.text(`${idx + 1}. ${alloc.invoice.invoiceNo} | Paid: $${alloc.amount.toFixed(2)} | Remaining: $${alloc.invoice.balanceDue.toFixed(2)}`);
      }
      doc.text("------------------------------------------------------------------");
      doc.moveDown();
    }

    doc.fontSize(11).text(`Paid toward delivered sales: $${p.allocatedAmount.toFixed(2)}`);
    if (p.unappliedAmount.gt(0)) doc.text(`${p.orderId ? "Order payment awaiting delivery" : "Needs Owner review"}: $${p.unappliedAmount.toFixed(2)}`);

    addDocumentFooter(doc, branding);
    doc.end();
  }

  @UseGuards(SessionGuard)
  @Post("payments/:id/reverse")
  async reversePayment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Headers("idempotency-key") headerKey: string | undefined,
    @Body() body: { reason?: string }
  ) {
    return { data: await this.simpleWorkflows.reversePayment(requireOwner(request), headerKey, id, body.reason) };
  }
  @UseGuards(SessionGuard)
  @Get("financial/debts")
  async accountsReceivableSummary() {
    const customers = await this.prisma.customer.findMany({
      where: { status: { in: ["ACTIVE", "HOLD"] } },
      include: {
        invoices: { where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } } }
      }
    });

    let totalSalesSum = dec("0");
    let totalPaidSum = dec("0");
    let totalDebtSum = dec("0");
    let totalPendingSum = dec("0");
    let totalReviewSum = dec("0");

    const items = [];

    for (const cust of customers) {
      const openInvoices = cust.invoices;
      const custDebt = openInvoices.reduce((sum, inv) => sum.add(inv.balanceDue), dec("0"));
      const account = await this.customerAccounts.read(cust.id);
      const invTotal = dec(account.summary.totalSales);
      const payTotal = dec(account.summary.totalPaid);
      const pendingTotal = dec(account.summary.pendingOrderRemaining);
      const reviewTotal = dec(account.summary.moneyToReview);

      totalSalesSum = totalSalesSum.add(invTotal);
      totalPaidSum = totalPaidSum.add(payTotal);
      totalDebtSum = totalDebtSum.add(custDebt);
      totalPendingSum = totalPendingSum.add(pendingTotal);
      totalReviewSum = totalReviewSum.add(reviewTotal);

      const now = new Date();
      let agingCurrent = dec("0");
      let aging30 = dec("0");
      let aging60 = dec("0");
      let aging90Plus = dec("0");

      for (const inv of openInvoices) {
        const ageDays = Math.floor((now.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays <= 30) agingCurrent = agingCurrent.add(inv.balanceDue);
        else if (ageDays <= 60) aging30 = aging30.add(inv.balanceDue);
        else if (ageDays <= 90) aging60 = aging60.add(inv.balanceDue);
        else aging90Plus = aging90Plus.add(inv.balanceDue);
      }

      items.push({
        customerId: cust.id,
        code: cust.code,
        name: cust.name,
        primaryPhone: cust.primaryPhone,
        status: cust.status,
        totalSales: invTotal.toFixed(2),
        totalPaid: payTotal.toFixed(4),
        remainingDebt: custDebt.toFixed(2),
        pendingOrders: pendingTotal.toFixed(2),
        moneyToReview: reviewTotal.toFixed(2),
        aging: {
          current: agingCurrent.toFixed(4),
          days31To60: aging30.toFixed(4),
          days61To90: aging60.toFixed(4),
          days90Plus: aging90Plus.toFixed(4)
        }
      });
    }

    return {
      data: {
        totals: {
          totalSales: totalSalesSum.toFixed(2),
          totalPaid: totalPaidSum.toFixed(2),
          remainingDebt: totalDebtSum.toFixed(2),
          pendingOrders: totalPendingSum.toFixed(2),
          moneyToReview: totalReviewSum.toFixed(2)
        },
        customers: items
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("customers/:id/account")
  async customerAccount(
    @Param("id") id: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string
  ) {
    return { data: await this.customerAccounts.read(id, fromDate, toDate) };
  }

  @UseGuards(SessionGuard)
  @Get("customers/:id/financial")
  async customerFinancialSummary(@Param("id") id: string) {
    const account = await this.customerAccounts.read(id);

    return {
      data: {
        customerId: account.customer.id,
        code: account.customer.code,
        name: account.customer.name,
        status: account.customer.status,
        totalInvoiced: account.summary.totalSales,
        totalPaid: account.summary.totalPaid,
        outstandingDebt: account.summary.remainingDebt,
        unappliedCredit: "0.0000",
        pendingOrderRemaining: account.summary.pendingOrderRemaining,
        moneyToReview: account.summary.moneyToReview,
        netPosition: account.summary.remainingDebt
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("customers/:id/statement")
  async customerStatement(@Param("id") id: string, @Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    const cust = await this.prisma.customer.findUnique({ where: { id } });
    if (!cust) throw new NotFoundException("Customer not found");

    const { start, end } = statementBounds(fromDate, toDate);
    const rows = await this.prisma.customerLedgerEntry.findMany({
      where: { customerId: id, ...(end ? { occurredAt: { lt: end } } : {}) },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return { data: { customer: { id: cust.id, code: cust.code, name: cust.name, phone: cust.primaryPhone }, ...statementRows(rows, start) } };
  }

  @UseGuards(SessionGuard)
  @Get("customers/:id/statement/pdf")
  async customerStatementPdf(@Param("id") id: string, @Res() response: Response, @Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    const account = await this.customerAccounts.read(id, fromDate, toDate);
    const { start, end } = statementBounds(fromDate, toDate);
    const dateFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", day: "2-digit", month: "short", year: "numeric" });
    const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Mogadishu", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const inPeriod = (value: Date) => (!start || value >= start) && (!end || value < end);
    const opening = Prisma.Decimal.max(dec("0"), dec(account.summary.openingBalance));
    const closing = Prisma.Decimal.max(dec("0"), dec(account.summary.closingBalance));
    const pdf = await createCustomerStatementPdf({
      customer: { name: account.customer.name, phone: account.customer.phone, location: account.customer.location },
      period: `${fromDate ?? "Start"} – ${toDate ?? dateFormatter.format(new Date())}`,
      generatedAt: `${dateFormatter.format(new Date())}, ${timeFormatter.format(new Date())}`,
      openingDebt: opening.toFixed(2),
      closingDebt: closing.toFixed(2),
      totalSales: dec(account.summary.totalSales).toFixed(2),
      totalPaid: dec(account.summary.totalPaid).toFixed(2),
      remainingDebt: dec(account.summary.remainingDebt).toFixed(2),
      pendingOrderRemaining: dec(account.summary.pendingOrderRemaining).toFixed(2),
      moneyToReview: dec(account.summary.moneyToReview).toFixed(2),
      orders: account.orders
        .filter((order) => !end || order.orderDate < end)
        .map((order) => {
          const debt = dec(order.debt);
          const pending = dec(order.pendingRemaining);
          return {
            date: dateFormatter.format(order.orderDate),
            orderNo: order.orderNo,
            fuel: order.fuel,
            acceptedSale: dec(order.deliveredTotal).toFixed(2),
            paid: dec(order.paidOnOrder).toFixed(2),
            remaining: debt.gt(0) ? debt.toFixed(2) : pending.toFixed(2),
            remainingLabel: debt.gt(0) ? "Debt" as const : pending.gt(0) ? "Order Remaining" as const : "Settled" as const,
            payments: order.payments.filter((payment) => inPeriod(payment.date)).map((payment) => ({
              date: dateFormatter.format(payment.date),
              reference: compactPaymentReference(payment.reference),
              amount: dec(payment.amount).toFixed(2),
              status: payment.status === "REVERSED" ? "Reversed" : "Paid"
            }))
          };
        }),
      branding: await this.documentBranding()
    });
    response.setHeader("Content-Disposition", "inline; filename=customer-statement.pdf");
    response.type("application/pdf").send(pdf);
  }

  @Get("health")
  health() {
    return { data: { status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() } };
  }

  @UseGuards(SessionGuard)
  @Get("dashboard/overview")
  async dashboardOverview() {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Mogadishu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const dayStart = new Date(`${today}T00:00:00+03:00`);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const collectedToday = await this.prisma.payment.aggregate({ where: { status: "POSTED", paymentDate: { gte: dayStart, lt: dayEnd } }, _sum: { amount: true } });
    const [
      totalCustomers,
      activeCustomers,
      holdCustomers,
      warehouseStock,
      inTransitStock,
      pendingOrders,
      dispatchedCount,
      unbilledCount,
      invoices,
      payments
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: "ACTIVE" } }),
      this.prisma.customer.count({ where: { status: "HOLD" } }),
      this.prisma.stockBalance.findMany({ where: { location: "WAREHOUSE" }, include: { fuel: true } }),
      this.prisma.stockBalance.findMany({ where: { location: "IN_TRANSIT" }, include: { fuel: true } }),
      this.prisma.salesOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED", "SCHEDULED", "IN_PROGRESS"] } } }),
      this.prisma.dispatch.count({ where: { status: { in: ["POSTED", "PARTIALLY_RECONCILED"] } } }),
      this.prisma.deliveryConfirmationLine.count({ where: { invoice: null, acceptedUnits: { gt: new Prisma.Decimal("0") } } }),
      this.prisma.invoice.aggregate({ where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } }, _sum: { balanceDue: true } }),
      this.prisma.payment.aggregate({ where: { status: "POSTED" }, _sum: { unappliedAmount: true } })
    ]);

    const warehouseByFuel: Record<string, string> = {};
    for (const b of warehouseStock) {
      warehouseByFuel[b.fuel.code] = b.balanceLiters.toFixed(3);
    }
    const inTransitByFuel: Record<string, string> = {};
    for (const b of inTransitStock) {
      inTransitByFuel[b.fuel.code] = b.balanceLiters.toFixed(3);
    }

    const outstandingDebt = invoices._sum.balanceDue?.toFixed(4) ?? "0.0000";
    const unappliedCredit = payments._sum.unappliedAmount?.toFixed(4) ?? "0.0000";

    return {
      data: {
        customers: { total: totalCustomers, active: activeCustomers, hold: holdCustomers },
        stock: { warehouse: warehouseByFuel, inTransit: inTransitByFuel },
        operations: { pendingOrders, dispatched: dispatchedCount, unbilledDeliveries: unbilledCount },
        financials: { totalOutstandingDebt: outstandingDebt, totalUnappliedCredit: unappliedCredit, collectedToday: collectedToday._sum.amount?.toFixed(4) ?? "0.0000" }
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("dashboard/analytics")
  async dashboardAnalytics(@Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const [invoices, payments, confirmationLines, topDebtCustomers] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { issueDate: { gte: start, lte: end }, status: { not: "REVERSED" } },
        include: { customer: true }
      }),
      this.prisma.payment.findMany({
        where: { paymentDate: { gte: start, lte: end }, status: "POSTED" },
        include: { customer: true }
      }),
      this.prisma.deliveryConfirmationLine.findMany({
        where: { confirmation: { confirmedAt: { gte: start, lte: end } } },
        include: { dispatchLine: { include: { orderLine: { include: { fuel: true } } } } }
      }),
      this.prisma.customer.findMany({
        where: { status: { in: ["ACTIVE", "HOLD"] } },
        include: { invoices: { where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } } } }
      })
    ]);

    // Daily Sales Aggregates
    const salesByDate: Record<string, Prisma.Decimal> = {};
    for (const inv of invoices) {
      const dateStr = inv.issueDate.toISOString().slice(0, 10);
      salesByDate[dateStr] = (salesByDate[dateStr] ?? dec("0")).add(inv.totalAmount);
    }
    const salesTrend = Object.entries(salesByDate).map(([date, amount]) => ({ date, amount: amount.toFixed(4) }));

    // Daily Collections Aggregates
    const collectionsByDate: Record<string, Prisma.Decimal> = {};
    for (const p of payments) {
      const dateStr = p.paymentDate.toISOString().slice(0, 10);
      collectionsByDate[dateStr] = (collectionsByDate[dateStr] ?? dec("0")).add(p.amount);
    }
    const collectionsTrend = Object.entries(collectionsByDate).map(([date, amount]) => ({ date, amount: amount.toFixed(4) }));

    // Fuel Volume Breakdown
    const fuelLiters: Record<string, Prisma.Decimal> = {};
    for (const line of confirmationLines) {
      const fuelCode = line.dispatchLine.orderLine.fuel.code;
      fuelLiters[fuelCode] = (fuelLiters[fuelCode] ?? dec("0")).add(line.acceptedLiters);
    }
    const fuelBreakdown = Object.entries(fuelLiters).map(([fuel, liters]) => ({ fuel, acceptedLiters: liters.toFixed(3) }));

    // Top 5 Customers by Revenue
    const revenueByCust: Record<string, { name: string; total: Prisma.Decimal }> = {};
    for (const inv of invoices) {
      const cId = inv.customerId;
      if (!revenueByCust[cId]) revenueByCust[cId] = { name: inv.customer.name, total: dec("0") };
      revenueByCust[cId].total = revenueByCust[cId].total.add(inv.totalAmount);
    }
    const topRevenue = Object.values(revenueByCust)
      .sort((a, b) => b.total.sub(a.total).toNumber())
      .slice(0, 5)
      .map((c) => ({ name: c.name, revenue: c.total.toFixed(4) }));

    // Top 5 Customers by Outstanding Debt
    const topDebt = topDebtCustomers
      .map((c) => ({
        name: c.name,
        debt: c.invoices.reduce((sum, inv) => sum.add(inv.balanceDue), dec("0"))
      }))
      .filter((c) => c.debt.gt(0))
      .sort((a, b) => b.debt.sub(a.debt).toNumber())
      .slice(0, 5)
      .map((c) => ({ name: c.name, debt: c.debt.toFixed(4) }));

    return {
      data: {
        period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
        salesTrend,
        collectionsTrend,
        fuelBreakdown,
        topRevenue,
        topDebt
      }
    };
  }

  // --- REPORT ENDPOINTS ---

  @UseGuards(SessionGuard)
  @Get("reports/customers")
  async reportsCustomers(@Query("search") search?: string) {
    const res = await this.accountsReceivableSummary();
    return res;
  }

  @UseGuards(SessionGuard)
  @Get("reports/customers/pdf")
  async reportsCustomersPdf(@Res() response: Response) {
    const data = await this.accountsReceivableSummary();
    const columns: ColumnDef[] = [
      { header: "Code", key: "code", width: 12 },
      { header: "Customer Name", key: "name", width: 25 },
      { header: "Phone", key: "primaryPhone", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Total Sales", key: "totalSales", format: "currency", align: "right" },
      { header: "Total Paid", key: "totalPaid", format: "currency", align: "right" },
      { header: "Debt", key: "remainingDebt", format: "currency", align: "right" },
      { header: "Pending Orders", key: "pendingOrders", format: "currency", align: "right" },
      { header: "Needs Review", key: "moneyToReview", format: "currency", align: "right" }
    ];
    const pdfBuffer = await this.exportPdf({
      title: "Customer List & Financial Position Report",
      columns,
      rows: data.data.customers,
      totals: data.data.totals
    });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/customers/xlsx")
  async reportsCustomersXlsx(@Res() response: Response) {
    const data = await this.accountsReceivableSummary();
    const columns: ColumnDef[] = [
      { header: "Code", key: "code", width: 12 },
      { header: "Customer Name", key: "name", width: 25 },
      { header: "Phone", key: "primaryPhone", width: 15 },
      { header: "Status", key: "status", width: 10 },
      { header: "Total Sales", key: "totalSales", format: "currency", align: "right" },
      { header: "Total Paid", key: "totalPaid", format: "currency", align: "right" },
      { header: "Debt", key: "remainingDebt", format: "currency", align: "right" },
      { header: "Pending Orders", key: "pendingOrders", format: "currency", align: "right" },
      { header: "Needs Review", key: "moneyToReview", format: "currency", align: "right" }
    ];
    const xlsxBuffer = await this.exportExcel({
      title: "Customer List & Financial Position Report",
      columns,
      rows: data.data.customers,
      totals: data.data.totals
    });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/debts")
  async reportsDebts() {
    return this.accountsReceivableSummary();
  }

  @UseGuards(SessionGuard)
  @Get("reports/debts/pdf")
  async reportsDebtsPdf(@Res() response: Response) {
    const data = await this.accountsReceivableSummary();
    const rows = data.data.customers.map((c) => ({
      code: c.code,
      name: c.name,
      remainingDebt: c.remainingDebt,
      pendingOrders: c.pendingOrders,
      moneyToReview: c.moneyToReview,
      current: c.aging.current,
      days31To60: c.aging.days31To60,
      days61To90: c.aging.days61To90,
      days90Plus: c.aging.days90Plus
    }));
    const columns: ColumnDef[] = [
      { header: "Code", key: "code", width: 12 },
      { header: "Customer Name", key: "name", width: 22 },
      { header: "Total Debt", key: "remainingDebt", format: "currency", align: "right" },
      { header: "Pending Orders", key: "pendingOrders", format: "currency", align: "right" },
      { header: "Needs Review", key: "moneyToReview", format: "currency", align: "right" },
      { header: "Current", key: "current", format: "currency", align: "right" },
      { header: "31-60 Days", key: "days31To60", format: "currency", align: "right" },
      { header: "61-90 Days", key: "days61To90", format: "currency", align: "right" },
      { header: "90+ Days", key: "days90Plus", format: "currency", align: "right" }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Accounts Receivable Debt Aging Report", columns, rows });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/debts/xlsx")
  async reportsDebtsXlsx(@Res() response: Response) {
    const data = await this.accountsReceivableSummary();
    const rows = data.data.customers.map((c) => ({
      code: c.code,
      name: c.name,
      remainingDebt: c.remainingDebt,
      pendingOrders: c.pendingOrders,
      moneyToReview: c.moneyToReview,
      current: c.aging.current,
      days31To60: c.aging.days31To60,
      days61To90: c.aging.days61To90,
      days90Plus: c.aging.days90Plus
    }));
    const columns: ColumnDef[] = [
      { header: "Code", key: "code", width: 12 },
      { header: "Customer Name", key: "name", width: 22 },
      { header: "Total Debt", key: "remainingDebt", format: "currency", align: "right" },
      { header: "Pending Orders", key: "pendingOrders", format: "currency", align: "right" },
      { header: "Needs Review", key: "moneyToReview", format: "currency", align: "right" },
      { header: "Current", key: "current", format: "currency", align: "right" },
      { header: "31-60 Days", key: "days31To60", format: "currency", align: "right" },
      { header: "61-90 Days", key: "days61To90", format: "currency", align: "right" },
      { header: "90+ Days", key: "days90Plus", format: "currency", align: "right" }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Accounts Receivable Debt Aging Report", columns, rows });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/statement")
  async reportsStatement(@Query("customerId") customerId?: string, @Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    if (!customerId) throw new BadRequestException("customerId parameter is required for statement report");
    return this.customerStatement(customerId, fromDate, toDate);
  }

  @UseGuards(SessionGuard)
  @Get("reports/statement/pdf")
  async reportsStatementPdf(@Query("customerId") customerId: string, @Res() response: Response) {
    if (!customerId) throw new BadRequestException("customerId is required");
    return this.customerStatementPdf(customerId, response);
  }

  @UseGuards(SessionGuard)
  @Get("reports/statement/xlsx")
  async reportsStatementXlsx(@Query("customerId") customerId: string, @Res() response: Response) {
    if (!customerId) throw new BadRequestException("customerId is required");
    const data = await this.customerStatement(customerId);
    const columns: ColumnDef[] = [
      { header: "Date", key: "occurredAt", width: 18 },
      { header: "Entry Type", key: "entryType", width: 15 },
      { header: "Reference", key: "referenceNo", width: 18 },
      { header: "Debit ($)", key: "debitAmount", format: "currency", align: "right" },
      { header: "Credit ($)", key: "creditAmount", format: "currency", align: "right" },
      { header: "Running Balance ($)", key: "runningBalance", format: "currency", align: "right" },
      { header: "Notes", key: "notes", width: 25 }
    ];
    const rows = data.data.entries.map((e) => ({
      ...e,
      occurredAt: e.occurredAt.toISOString().slice(0, 10)
    }));
    const xlsxBuffer = await this.exportExcel({
      title: `Statement of Account — ${data.data.customer.name}`,
      columns,
      rows
    });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/sales")
  async reportsSales(@Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string, @Query("customerId") customerId?: string) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        orderDate: { gte: start, lte: end },
        ...(customerId ? { customerId } : {})
      },
      include: { customer: true, lines: { include: { fuel: true, salesUnit: true } } },
      orderBy: { orderDate: "desc" }
    });

    const items = orders.flatMap((o) =>
      o.lines.map((l) => ({
        orderNo: o.orderNo,
        orderDate: o.orderDate.toISOString().slice(0, 10),
        customerName: o.customer.name,
        fuelName: l.fuel.displayName,
        salesUnitName: l.salesUnit.name,
        requestedUnits: l.requestedUnits.toFixed(3),
        requestedLiters: jsonDecimal(l.requestedLitersSnapshot),
        unitPrice: jsonDecimal(l.unitPriceSnapshot),
        lineTotal: l.requestedUnits && l.unitPriceSnapshot ? l.requestedUnits.mul(l.unitPriceSnapshot).toFixed(4) : null,
        status: o.status
      }))
    );

    return { data: { period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, items } };
  }

  @UseGuards(SessionGuard)
  @Get("reports/sales/pdf")
  async reportsSalesPdf(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Res() response: Response) {
    const data = await this.reportsSales(fromDate, toDate, customerId);
    const columns: ColumnDef[] = [
      { header: "Order No", key: "orderNo", width: 14 },
      { header: "Date", key: "orderDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Fuel", key: "fuelName", width: 12 },
      { header: "Units", key: "requestedUnits", format: "decimal", align: "right" },
      { header: "Unit Price", key: "unitPrice", format: "currency", align: "right" },
      { header: "Total ($)", key: "lineTotal", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Sales Orders Report", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/sales/xlsx")
  async reportsSalesXlsx(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Res() response: Response) {
    const data = await this.reportsSales(fromDate, toDate, customerId);
    const columns: ColumnDef[] = [
      { header: "Order No", key: "orderNo", width: 14 },
      { header: "Date", key: "orderDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Fuel", key: "fuelName", width: 12 },
      { header: "Units", key: "requestedUnits", format: "decimal", align: "right" },
      { header: "Unit Price", key: "unitPrice", format: "currency", align: "right" },
      { header: "Total ($)", key: "lineTotal", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Sales Orders Report", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/collections")
  async reportsCollections(@Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string, @Query("customerId") customerId?: string) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const payments = await this.prisma.payment.findMany({
      where: {
        paymentDate: { gte: start, lte: end },
        ...(customerId ? { customerId } : {})
      },
      include: { customer: true, recordedBy: true, order: true, allocations: { include: { invoice: { include: { lines: { include: { orderLine: { include: { order: true } } } } } } } } },
      orderBy: [{ paymentDate: "desc" }, { id: "desc" }]
    });

    const items = payments.map((p) => {
      const orderNumbers = new Set<string>();
      if (p.order) orderNumbers.add(p.order.orderNo);
      for (const allocation of p.allocations) for (const line of allocation.invoice.lines) orderNumbers.add(line.orderLine.order.orderNo);
      return {
      paymentDate: p.paymentDate.toISOString().slice(0, 10),
      customerName: p.customer.name,
      order: orderNumbers.size === 0 ? "Needs review" : orderNumbers.size === 1 ? [...orderNumbers][0]! : "Multiple orders",
      paid: p.amount.toFixed(2),
      status: p.status === "REVERSED" ? "Reversed" : p.orderId ? "Order payment" : "Paid",
      recordedBy: p.recordedBy.displayName
    }; });
    const totalCollected = payments.reduce((sum, payment) => payment.status === "POSTED" ? sum.add(payment.amount) : sum, dec("0"));

    return { data: { period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, totals: { totalCollected: totalCollected.toFixed(2) }, items } };
  }

  @UseGuards(SessionGuard)
  @Get("reports/collections/pdf")
  async reportsCollectionsPdf(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Res() response: Response) {
    const data = await this.reportsCollections(fromDate, toDate, customerId);
    const columns: ColumnDef[] = [
      { header: "Date", key: "paymentDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Order", key: "order", width: 18 },
      { header: "Paid ($)", key: "paid", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 15 },
      { header: "Recorded by", key: "recordedBy", width: 18 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Payment Collections Report", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/collections/xlsx")
  async reportsCollectionsXlsx(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Res() response: Response) {
    const data = await this.reportsCollections(fromDate, toDate, customerId);
    const columns: ColumnDef[] = [
      { header: "Date", key: "paymentDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Order", key: "order", width: 18 },
      { header: "Paid ($)", key: "paid", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 15 },
      { header: "Recorded by", key: "recordedBy", width: 18 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Payment Collections Report", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/inventory")
  async reportsInventory(@Query("fuelId") fuelId?: string) {
    const balances = await this.prisma.stockBalance.findMany({
      where: fuelId ? { fuelId } : undefined,
      include: { fuel: true },
      orderBy: [{ fuel: { code: "asc" } }, { location: "asc" }]
    });
    const items = balances.map((b) => ({
      fuelCode: b.fuel.code,
      fuelName: b.fuel.displayName,
      location: b.location,
      balanceLiters: b.balanceLiters.toFixed(3)
    }));
    return { data: { items } };
  }

  @UseGuards(SessionGuard)
  @Get("reports/inventory/pdf")
  async reportsInventoryPdf(@Res() response: Response) {
    const data = await this.reportsInventory();
    const columns: ColumnDef[] = [
      { header: "Fuel Code", key: "fuelCode", width: 15 },
      { header: "Fuel Name", key: "fuelName", width: 25 },
      { header: "Location", key: "location", width: 18 },
      { header: "Balance (Liters)", key: "balanceLiters", format: "decimal", align: "right" }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Inventory Stock Balances Report", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/inventory/xlsx")
  async reportsInventoryXlsx(@Res() response: Response) {
    const data = await this.reportsInventory();
    const columns: ColumnDef[] = [
      { header: "Fuel Code", key: "fuelCode", width: 15 },
      { header: "Fuel Name", key: "fuelName", width: 25 },
      { header: "Location", key: "location", width: 18 },
      { header: "Balance (Liters)", key: "balanceLiters", format: "decimal", align: "right" }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Inventory Stock Balances Report", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get(["reports/stock-receipts", "reports/tanker-receipts"])
  async reportsStockReceipts(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    const isOwner = request.actor?.role === "OWNER";
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const receipts = await this.prisma.tankerReceipt.findMany({
      where: { arrivedAt: { gte: start, lte: end } },
      include: { lines: { include: { fuel: true } }, createdBy: true },
      orderBy: { arrivedAt: "desc" }
    });

    const items = receipts.flatMap((r) =>
      r.lines.map((l) => ({
        receiptNo: r.receiptNo,
        supplierReference: r.tankerReference ?? "—",
        purchaseDate: r.arrivedAt.toISOString().slice(0, 10),
        status: r.status,
        fuelName: l.fuel.displayName,
        quantityFuusto: (l.quantityFuusto ?? l.actualLiters.div(240)).toFixed(3),
        litersPerFuusto: (l.litersPerFuustoSnapshot ?? dec("240")).toFixed(3),
        actualLiters: l.actualLiters.toFixed(3),
        unitPurchaseCost: isOwner ? jsonDecimal(l.unitPurchaseCost) : undefined,
        totalPurchaseCost: isOwner ? (l.totalPurchaseCost ? l.totalPurchaseCost.toFixed(4) : (l.unitPurchaseCost ? (l.quantityFuusto ? l.quantityFuusto.mul(l.unitPurchaseCost) : l.actualLiters.div(240).mul(l.unitPurchaseCost)).toFixed(4) : null)) : undefined
      }))
    );

    return { data: { period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, items } };
  }

  @UseGuards(SessionGuard)
  @Get(["reports/stock-receipts/pdf", "reports/tanker-receipts/pdf"])
  async reportsStockReceiptsPdf(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    const isOwner = request.actor?.role === "OWNER";
    const data = await this.reportsStockReceipts(request, fromDate, toDate);
    const columns: ColumnDef[] = [
      { header: "Receipt No", key: "receiptNo", width: 14 },
      { header: "Supplier / Reference", key: "supplierReference", width: 18 },
      { header: "Purchased", key: "purchaseDate", width: 12 },
      { header: "Fuel", key: "fuelName", width: 14 },
      { header: "Quantity (Fuusto)", key: "quantityFuusto", format: "decimal", align: "right" },
      { header: "Liters", key: "actualLiters", format: "decimal", align: "right" },
      ...(isOwner
        ? [
            { header: "Cost/Fuusto ($)", key: "unitPurchaseCost", format: "currency" as const, align: "right" as const },
            { header: "Total Cost ($)", key: "totalPurchaseCost", format: "currency" as const, align: "right" as const }
          ]
        : []),
      { header: "Status", key: "status", width: 12 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Fuel Stock Purchases Report", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get(["reports/stock-receipts/xlsx", "reports/tanker-receipts/xlsx"])
  async reportsStockReceiptsXlsx(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    const isOwner = request.actor?.role === "OWNER";
    const data = await this.reportsStockReceipts(request, fromDate, toDate);
    const columns: ColumnDef[] = [
      { header: "Receipt No", key: "receiptNo", width: 14 },
      { header: "Supplier / Reference", key: "supplierReference", width: 18 },
      { header: "Purchased", key: "purchaseDate", width: 12 },
      { header: "Fuel", key: "fuelName", width: 14 },
      { header: "Quantity (Fuusto)", key: "quantityFuusto", format: "decimal", align: "right" },
      { header: "Liters", key: "actualLiters", format: "decimal", align: "right" },
      ...(isOwner
        ? [
            { header: "Cost/Fuusto ($)", key: "unitPurchaseCost", format: "currency" as const, align: "right" as const },
            { header: "Total Cost ($)", key: "totalPurchaseCost", format: "currency" as const, align: "right" as const }
          ]
        : []),
      { header: "Status", key: "status", width: 12 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Fuel Stock Purchases Report", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/deliveries")
  async reportsDeliveries(@Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const dispatches = await this.prisma.dispatch.findMany({
      where: fromDate || toDate ? { OR: [{ postedAt: { gte: start, lte: end } }, { deliverySheet: { serviceDate: { gte: start, lte: end } } }] } : undefined,
      include: {
        deliverySheet: true,
        lines: {
          include: {
            orderLine: { include: { order: { include: { customer: true } }, fuel: true } },
            confirmations: true
          }
        }
      },
      orderBy: { dispatchNo: "desc" }
    });

    const items = dispatches.flatMap((d) =>
      d.lines.map((l) => {
        const accepted = (l.confirmations ?? []).reduce((sum, c) => sum.add(dec(c.acceptedUnits.toString())), dec("0"));
        const acceptedLit = (l.confirmations ?? []).reduce((sum, c) => sum.add(dec(c.acceptedLiters.toString())), dec("0"));
        const returnedLit = (l.confirmations ?? []).reduce((sum, c) => sum.add(dec(c.physicalReturnedLiters.toString())), dec("0"));
        return {
          dispatchNo: d.dispatchNo,
          serviceDate: d.deliverySheet?.serviceDate.toISOString().slice(0, 10) ?? "—",
          customerName: l.orderLine.order.customer.name,
          fuelName: l.orderLine.fuel.displayName,
          dispatchedUnits: l.dispatchedUnits.toFixed(3),
          dispatchedLiters: l.dispatchedLiters.toFixed(3),
          acceptedUnits: accepted.toFixed(3),
          acceptedLiters: acceptedLit.toFixed(3),
          physicalReturnedLiters: returnedLit.toFixed(3),
          status: d.status
        };
      })
    );

    return { data: { period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, items } };
  }

  @UseGuards(SessionGuard)
  @Get("reports/deliveries/pdf")
  async reportsDeliveriesPdf(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    const data = await this.reportsDeliveries(fromDate, toDate);
    const columns: ColumnDef[] = [
      { header: "Dispatch No", key: "dispatchNo", width: 14 },
      { header: "Service Date", key: "serviceDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Fuel", key: "fuelName", width: 12 },
      { header: "Dispatched Units", key: "dispatchedUnits", format: "decimal", align: "right" },
      { header: "Accepted Units", key: "acceptedUnits", format: "decimal", align: "right" },
      { header: "Returned (L)", key: "physicalReturnedLiters", format: "decimal", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Actual Delivery & Reconciliation Report (Non-Financial)", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/deliveries/xlsx")
  async reportsDeliveriesXlsx(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    const data = await this.reportsDeliveries(fromDate, toDate);
    const columns: ColumnDef[] = [
      { header: "Dispatch No", key: "dispatchNo", width: 14 },
      { header: "Service Date", key: "serviceDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Fuel", key: "fuelName", width: 12 },
      { header: "Dispatched Units", key: "dispatchedUnits", format: "decimal", align: "right" },
      { header: "Accepted Units", key: "acceptedUnits", format: "decimal", align: "right" },
      { header: "Returned (L)", key: "physicalReturnedLiters", format: "decimal", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Actual Delivery & Reconciliation Report (Non-Financial)", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/invoices")
  async reportsInvoices(@Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string, @Query("customerId") customerId?: string, @Query("status") status?: string) {
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        issueDate: { gte: start, lte: end },
        ...(customerId ? { customerId } : {}),
        ...(status ? { status: status as Prisma.EnumInvoiceStatusFilter } : {})
      },
      include: { customer: true },
      orderBy: { issueDate: "desc" }
    });

    const items = invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      issueDate: inv.issueDate.toISOString().slice(0, 10),
      dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? "—",
      customerName: inv.customer.name,
      totalAmount: inv.totalAmount.toFixed(4),
      paidAmount: inv.paidAmount.toFixed(4),
      balanceDue: inv.balanceDue.toFixed(4),
      status: inv.status
    }));

    return { data: { period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }, items } };
  }

  @UseGuards(SessionGuard)
  @Get("reports/invoices/pdf")
  async reportsInvoicesPdf(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Query("status") status: string | undefined, @Res() response: Response) {
    const data = await this.reportsInvoices(fromDate, toDate, customerId, status);
    const columns: ColumnDef[] = [
      { header: "Invoice No", key: "invoiceNo", width: 14 },
      { header: "Issue Date", key: "issueDate", width: 12 },
      { header: "Due Date", key: "dueDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Total ($)", key: "totalAmount", format: "currency", align: "right" },
      { header: "Paid ($)", key: "paidAmount", format: "currency", align: "right" },
      { header: "Balance Due ($)", key: "balanceDue", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Invoices & Revenue Ledger Report", columns, rows: data.data.items });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/invoices/xlsx")
  async reportsInvoicesXlsx(@Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Query("customerId") customerId: string | undefined, @Query("status") status: string | undefined, @Res() response: Response) {
    const data = await this.reportsInvoices(fromDate, toDate, customerId, status);
    const columns: ColumnDef[] = [
      { header: "Invoice No", key: "invoiceNo", width: 14 },
      { header: "Issue Date", key: "issueDate", width: 12 },
      { header: "Due Date", key: "dueDate", width: 12 },
      { header: "Customer", key: "customerName", width: 22 },
      { header: "Total ($)", key: "totalAmount", format: "currency", align: "right" },
      { header: "Paid ($)", key: "paidAmount", format: "currency", align: "right" },
      { header: "Balance Due ($)", key: "balanceDue", format: "currency", align: "right" },
      { header: "Status", key: "status", width: 14 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Invoices & Revenue Ledger Report", columns, rows: data.data.items });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/profitability")
  async reportsProfitability(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate?: string, @Query("toDate") toDate?: string) {
    requireOwner(request);
    const start = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = toDate ? new Date(`${toDate}T23:59:59.999Z`) : new Date();

    const [invoices, stockReceiptLines] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { issueDate: { gte: start, lte: end }, status: { not: "REVERSED" } },
        include: { lines: { include: { fuel: true } } }
      }),
      this.prisma.tankerReceiptLine.findMany({
        where: { receipt: { arrivedAt: { gte: start, lte: end }, status: "POSTED" } },
        include: { fuel: true }
      })
    ]);

    let totalRevenue = dec("0");
    for (const inv of invoices) {
      totalRevenue = totalRevenue.add(inv.totalAmount);
    }

    let totalStockPurchaseCost = dec("0");
    let missingPurchaseCostCount = 0;
    for (const line of stockReceiptLines) {
      const quantityFuusto = line.quantityFuusto ?? line.actualLiters.div(240);
      const lineCost = line.totalPurchaseCost ?? (line.unitPurchaseCost ? line.unitPurchaseCost.mul(quantityFuusto) : null);
      if (lineCost) totalStockPurchaseCost = totalStockPurchaseCost.add(lineCost);
      else missingPurchaseCostCount += 1;
    }

    return {
      data: {
        period: { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) },
        revenue: {
          confirmedInvoicedRevenue: totalRevenue.toFixed(4),
          invoiceCount: invoices.length
        },
        purchaseCosts: {
          totalStockPurchaseCost: totalStockPurchaseCost.toFixed(4),
          stockReceiptLinesCount: stockReceiptLines.length,
          missingPurchaseCostCount
        },
        disclosures: {
          policyStatus: "COST_PROFIT_FORMULA_UNCONFIRMED",
          costAllocationMethod: "Pending decision log D-023 (FIFO vs Weighted Avg per fuel type). Direct unit margin calculations require owner-confirmed costing policy.",
          profitabilityAvailability: "Profit unavailable — purchase cost not recorded.",
          revenueBasis: "Confirmed accepted delivered quantities (D-023)."
        }
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("reports/profitability/pdf")
  async reportsProfitabilityPdf(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    requireOwner(request);
    const data = await this.reportsProfitability(request, fromDate, toDate);
    const rows = [
      { metric: "Confirmed Invoiced Revenue", amount: data.data.revenue.confirmedInvoicedRevenue, count: data.data.revenue.invoiceCount },
      { metric: "Total Recorded Stock Purchase Cost", amount: data.data.purchaseCosts.totalStockPurchaseCost, count: data.data.purchaseCosts.stockReceiptLinesCount }
    ];
    const columns: ColumnDef[] = [
      { header: "Financial Category", key: "metric", width: 30 },
      { header: "Total Amount ($)", key: "amount", format: "currency", align: "right" },
      { header: "Document Count", key: "count", align: "right" }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Financial Revenue & Stock Purchase Summary (Owner Only)", columns, rows });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("reports/profitability/xlsx")
  async reportsProfitabilityXlsx(@Req() request: AuthenticatedRequest, @Query("fromDate") fromDate: string | undefined, @Query("toDate") toDate: string | undefined, @Res() response: Response) {
    requireOwner(request);
    const data = await this.reportsProfitability(request, fromDate, toDate);
    const rows = [
      { metric: "Confirmed Invoiced Revenue", amount: data.data.revenue.confirmedInvoicedRevenue, count: data.data.revenue.invoiceCount },
      { metric: "Total Recorded Stock Purchase Cost", amount: data.data.purchaseCosts.totalStockPurchaseCost, count: data.data.purchaseCosts.stockReceiptLinesCount }
    ];
    const columns: ColumnDef[] = [
      { header: "Financial Category", key: "metric", width: 30 },
      { header: "Total Amount ($)", key: "amount", format: "currency", align: "right" },
      { header: "Document Count", key: "count", align: "right" }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Financial Revenue & Stock Purchase Summary (Owner Only)", columns, rows });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }

  // --- AUDIT LOGS ENDPOINT ---

  @UseGuards(SessionGuard)
  @Get("audits")
  async audits(
    @Req() request: AuthenticatedRequest,
    @Query("entityType") entityType?: string,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
    @Query("page") pageQuery?: string,
    @Query("limit") limitQuery?: string
  ) {
    requireOwner(request);
    const page = Math.max(1, parseInt(pageQuery ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitQuery ?? "50", 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditEventWhereInput = {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00.000Z`) } : {}),
              ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    };

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: { actor: { select: { id: true, displayName: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      this.prisma.auditEvent.count({ where })
    ]);

    return {
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  @UseGuards(SessionGuard)
  @Get("audits/pdf")
  async auditsPdf(
    @Req() request: AuthenticatedRequest,
    @Query("entityType") entityType: string | undefined,
    @Query("action") action: string | undefined,
    @Query("fromDate") fromDate: string | undefined,
    @Query("toDate") toDate: string | undefined,
    @Res() response: Response
  ) {
    requireOwner(request);
    const data = await this.audits(request, entityType, action, undefined, fromDate, toDate, "1", "500");
    const rows = data.data.items.map((a) => ({
      createdAt: a.createdAt.toISOString().slice(0, 19).replace("T", " "),
      actor: a.actor ? `${a.actor.displayName} (${a.actor.role})` : "System",
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      reason: a.reason ?? "—"
    }));
    const columns: ColumnDef[] = [
      { header: "Timestamp (UTC)", key: "createdAt", width: 18 },
      { header: "Actor", key: "actor", width: 20 },
      { header: "Entity", key: "entityType", width: 15 },
      { header: "Entity ID", key: "entityId", width: 15 },
      { header: "Action", key: "action", width: 12 },
      { header: "Reason", key: "reason", width: 20 }
    ];
    const pdfBuffer = await this.exportPdf({ title: "Audit Trail & System Security Logs", columns, rows });
    response.type("application/pdf").send(pdfBuffer);
  }

  @UseGuards(SessionGuard)
  @Get("audits/xlsx")
  async auditsXlsx(
    @Req() request: AuthenticatedRequest,
    @Query("entityType") entityType: string | undefined,
    @Query("action") action: string | undefined,
    @Query("fromDate") fromDate: string | undefined,
    @Query("toDate") toDate: string | undefined,
    @Res() response: Response
  ) {
    requireOwner(request);
    const data = await this.audits(request, entityType, action, undefined, fromDate, toDate, "1", "500");
    const rows = data.data.items.map((a) => ({
      createdAt: a.createdAt.toISOString().slice(0, 19).replace("T", " "),
      actor: a.actor ? `${a.actor.displayName} (${a.actor.role})` : "System",
      entityType: a.entityType,
      entityId: a.entityId,
      action: a.action,
      reason: a.reason ?? "—"
    }));
    const columns: ColumnDef[] = [
      { header: "Timestamp (UTC)", key: "createdAt", width: 18 },
      { header: "Actor", key: "actor", width: 20 },
      { header: "Entity", key: "entityType", width: 15 },
      { header: "Entity ID", key: "entityId", width: 15 },
      { header: "Action", key: "action", width: 12 },
      { header: "Reason", key: "reason", width: 20 }
    ];
    const xlsxBuffer = await this.exportExcel({ title: "Audit Trail & System Security Logs", columns, rows });
    response.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(xlsxBuffer);
  }
}
