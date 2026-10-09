import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query, Req, Res, UseGuards, BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Response } from "express";
import argon2 from "argon2";
import PDFDocument from "pdfkit";
import { Prisma, PrismaClient } from "@fuel/database";
import { deliveryManifestLineSchema } from "@fuel/shared";
import { AuthenticatedRequest, hashToken, newSessionToken, requireActor, requireOwner, SessionGuard } from "./auth.js";
import { PrismaService } from "./prisma.service.js";

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
  public constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    return { data: rows.map((row) => ({ fuel: row.fuel.code, fuelName: row.fuel.displayName, location: row.location, balanceLiters: row.balanceLiters.toFixed(3) })) };
  }

  @UseGuards(SessionGuard)
  @Get("stock/movements")
  async stockMovements(@Query("fuelId") fuelId?: string) {
    const rows = await this.prisma.inventoryMovement.findMany({ where: fuelId ? { fuelId } : undefined, include: { fuel: true }, orderBy: { occurredAt: "desc" }, take: 200 });
    return { data: rows.map((row) => ({ id: row.id, fuel: row.fuel.code, fuelName: row.fuel.displayName, location: row.location, eventType: row.eventType, quantityLiters: row.signedDeltaLiters.toFixed(3), sourceType: row.sourceType, sourceId: row.sourceId, occurredAt: row.occurredAt })) };
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
    const effective = new Date(body.effectiveFromUtc);
    if (Number.isNaN(effective.getTime())) throw new BadRequestException("Invalid effectiveFromUtc");
    const overlap = await this.prisma.fuelUnitVersion.findFirst({ where: { fuelId: body.fuelId, salesUnitId: body.salesUnitId, effectiveFromUtc: { lt: effective }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: effective } }] } });
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
  async priceHistory() { const rows = await this.prisma.priceVersion.findMany({ include: { fuel: true, salesUnit: true }, orderBy: { effectiveFromUtc: "desc" } }); return { data: rows.map((row) => ({ ...row, unitPrice: row.unitPrice.toFixed(4) })) }; }

  @UseGuards(SessionGuard)
  @Post("prices")
  async createPrice(@Req() request: AuthenticatedRequest, @Body() body: { fuelId?: string; salesUnitId?: string; unitPrice?: string; effectiveFromUtc?: string; reason?: string }) {
    const actor = requireOwner(request);
    if (!body.fuelId || !body.salesUnitId || !body.unitPrice || !body.effectiveFromUtc) throw new BadRequestException("fuelId, salesUnitId, unitPrice and effectiveFromUtc are required");
    const price = positive(body.unitPrice, "unitPrice"); const effective = new Date(body.effectiveFromUtc); if (Number.isNaN(effective.getTime())) throw new BadRequestException("Invalid effectiveFromUtc");
    const overlap = await this.prisma.priceVersion.findFirst({ where: { fuelId: body.fuelId, salesUnitId: body.salesUnitId, effectiveFromUtc: { lt: effective }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: effective } }] } }); if (overlap) throw new BadRequestException("Price effective period overlaps an existing version");
    const previous = await this.prisma.priceVersion.findFirst({ where: { fuelId: body.fuelId, salesUnitId: body.salesUnitId, effectiveFromUtc: { lt: effective } }, orderBy: { effectiveFromUtc: "desc" } });
    const row = await this.prisma.$transaction(async (tx) => { if (previous && !previous.effectiveToUtc) await tx.priceVersion.update({ where: { id: previous.id }, data: { effectiveToUtc: effective } }); const created = await tx.priceVersion.create({ data: { fuelId: body.fuelId!, salesUnitId: body.salesUnitId!, unitPrice: price, effectiveFromUtc: effective, reason: body.reason, createdById: actor.id } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "PriceVersion", entityId: created.id, action: "CREATED", afterRedacted: { fuelId: created.fuelId, salesUnitId: created.salesUnitId, unitPrice: created.unitPrice.toFixed(4) } } }); return created; });
    return { data: { ...row, unitPrice: row.unitPrice.toFixed(4) } };
  }

  @UseGuards(SessionGuard)
  @Get("tanker-receipts")
  async receipts(@Req() request: AuthenticatedRequest) { const rows = await this.prisma.tankerReceipt.findMany({ include: { lines: { include: { fuel: true } } }, orderBy: { arrivedAt: "desc" } }); return { data: rows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line, actualLiters: line.actualLiters.toFixed(3), expectedLiters: line.expectedLiters?.toFixed(3) ?? null, unitPurchaseCost: request.actor?.role === "OWNER" ? line.unitPurchaseCost?.toFixed(4) ?? null : undefined })) })) }; }

  @UseGuards(SessionGuard)
  @Post("tanker-receipts")
  async createReceipt(@Req() request: AuthenticatedRequest, @Body() body: { tankerReference?: string; arrivedAt?: string; lines?: Array<{ fuelId?: string; actualLiters?: string; expectedLiters?: string; unitPurchaseCost?: string }> }) {
    const actor = requireActor(request); if (!body.arrivedAt || !body.lines?.length) throw new BadRequestException("arrivedAt and at least one line are required");
    const lines = body.lines.map((line) => { if (!line.fuelId || !line.actualLiters) throw new BadRequestException("Each receipt line needs fuelId and actualLiters"); return { fuelId: line.fuelId, actualLiters: positive(line.actualLiters, "actualLiters"), expectedLiters: line.expectedLiters ? positive(line.expectedLiters, "expectedLiters") : undefined, unitPurchaseCost: line.unitPurchaseCost && actor.role === "OWNER" ? positive(line.unitPurchaseCost, "unitPurchaseCost") : undefined }; });
    const row = await this.prisma.tankerReceipt.create({ data: { receiptNo: documentNo("BR"), tankerReference: body.tankerReference, arrivedAt: new Date(body.arrivedAt), createdById: actor.id, lines: { create: lines } }, include: { lines: true } }); return { data: row };
  }

  @UseGuards(SessionGuard)
  @Post("tanker-receipts/:id/post")
  async postReceipt(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") headerKey?: string) {
    const actor = requireActor(request); const key = requireIdempotencyKey(headerKey); const row = await this.prisma.tankerReceipt.findUnique({ where: { id }, include: { lines: true } }); if (!row) throw new NotFoundException("Receipt not found"); if (row.status === "POSTED") return { data: { id: row.id, status: row.status, replay: true } }; if (row.status !== "DRAFT") throw new BadRequestException("Only draft receipts can be posted");
    await this.prisma.$transaction(async (tx) => { const claimed = await tx.tankerReceipt.updateMany({ where: { id, status: "DRAFT" }, data: { status: "POSTED", postedById: actor.id, postedAt: new Date(), postIdempotencyKey: key } }); if (claimed.count !== 1) throw new BadRequestException("Receipt was already posted"); for (const line of row.lines) { await tx.inventoryMovement.create({ data: { fuelId: line.fuelId, location: "WAREHOUSE", signedDeltaLiters: line.actualLiters, eventType: "RECEIPT", sourceType: "TankerReceiptLine", sourceId: row.id, sourceLineId: line.id, createdById: actor.id } }); await tx.stockBalance.update({ where: { fuelId_location: { fuelId: line.fuelId, location: "WAREHOUSE" } }, data: { balanceLiters: { increment: line.actualLiters }, version: { increment: 1 } } }); } await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "TankerReceipt", entityId: id, action: "POSTED" } }); });
    return { data: { id, status: "POSTED" } };
  }

  @UseGuards(SessionGuard)
  @Get("customers")
  async customers(@Query("search") search?: string) { return { data: await this.prisma.customer.findMany({ where: search ? { name: { contains: search, mode: "insensitive" } } : undefined, include: { addresses: true }, orderBy: { name: "asc" }, take: 100 }) }; }

  @UseGuards(SessionGuard)
  @Post("customers")
  async createCustomer(@Req() request: AuthenticatedRequest, @Body() body: { name?: string; primaryPhone?: string; address?: string }) { const actor = requireActor(request); if (!body.name?.trim()) throw new BadRequestException("name is required"); const row = await this.prisma.customer.create({ data: { code: documentNo("CUS"), name: body.name.trim(), primaryPhone: body.primaryPhone, createdById: actor.id, addresses: body.address ? { create: { label: "Primary", addressText: body.address, isDefault: true } } : undefined }, include: { addresses: true } }); return { data: row }; }

  @UseGuards(SessionGuard)
  @Get("customers/:id")
  async customer(@Param("id") id: string) { const row = await this.prisma.customer.findUnique({ where: { id }, include: { addresses: true, orders: { include: { lines: { include: { fuel: true } } }, orderBy: { orderDate: "desc" } } } }); if (!row) throw new NotFoundException("Customer not found"); return { data: row }; }

  @UseGuards(SessionGuard)
  @Patch("customers/:id")
  async updateCustomer(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: { name?: string; primaryPhone?: string; status?: "ACTIVE" | "HOLD" | "INACTIVE"; notes?: string }) { const actor = requireActor(request); const existing = await this.prisma.customer.findUnique({ where: { id } }); if (!existing) throw new NotFoundException("Customer not found"); const row = await this.prisma.$transaction(async (tx) => { const updated = await tx.customer.update({ where: { id }, data: { name: body.name?.trim() || undefined, primaryPhone: body.primaryPhone, status: body.status, notes: body.notes } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Customer", entityId: id, action: "UPDATED", beforeRedacted: { name: existing.name, primaryPhone: existing.primaryPhone, status: existing.status }, afterRedacted: { name: updated.name, primaryPhone: updated.primaryPhone, status: updated.status } } }); return updated; }); return { data: row }; }

  @UseGuards(SessionGuard)
  @Post("orders")
  async createOrder(@Req() request: AuthenticatedRequest, @Body() body: { customerId?: string; addressSnapshot?: string; requestedDeliveryDate?: string; notes?: string; lines?: Array<{ fuelId?: string; salesUnitId?: string; requestedUnits?: string }> }) {
    const actor = requireActor(request); if (!body.customerId || !body.addressSnapshot || !body.lines?.length) throw new BadRequestException("customerId, addressSnapshot and lines are required"); const lines = body.lines.map((line) => { if (!line.fuelId || !line.salesUnitId || !line.requestedUnits) throw new BadRequestException("Each order line needs fuelId, salesUnitId and requestedUnits"); return { fuelId: line.fuelId, salesUnitId: line.salesUnitId, requestedUnits: positive(line.requestedUnits, "requestedUnits") }; }); const row = await this.prisma.salesOrder.create({ data: { orderNo: documentNo("SO"), customerId: body.customerId, addressSnapshot: body.addressSnapshot, requestedDeliveryDate: body.requestedDeliveryDate ? localDate(body.requestedDeliveryDate) : undefined, orderDate: new Date(), notes: body.notes, createdById: actor.id, lines: { create: lines } }, include: { lines: true } }); return { data: row };
  }

  @UseGuards(SessionGuard)
  @Get("orders")
  async orders() { const rows = await this.prisma.salesOrder.findMany({ include: { customer: true, lines: { include: { fuel: true, salesUnit: true } } }, orderBy: { orderDate: "desc" }, take: 200 }); return { data: rows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line, requestedUnits: line.requestedUnits.toFixed(3), requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot), litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot), unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot) })) })) }; }

  @UseGuards(SessionGuard)
  @Get("orders/:id")
  async order(@Param("id") id: string) { const row = await this.prisma.salesOrder.findUnique({ where: { id }, include: { customer: true, lines: { include: { fuel: true, salesUnit: true, dispatchLines: { include: { confirmations: true } } } }, events: { orderBy: { occurredAt: "asc" } } } }); if (!row) throw new NotFoundException("Order not found"); return { data: { ...row, lines: row.lines.map((line) => ({ ...line, requestedUnits: line.requestedUnits.toFixed(3), requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot), litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot), unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot), dispatchLines: line.dispatchLines.map((dispatchLine) => ({ ...dispatchLine, dispatchedUnits: dispatchLine.dispatchedUnits.toFixed(3), dispatchedLiters: dispatchLine.dispatchedLiters.toFixed(3), confirmations: dispatchLine.confirmations.map((item) => ({ ...item, acceptedUnits: item.acceptedUnits.toFixed(3), acceptedLiters: item.acceptedLiters.toFixed(3), physicalReturnedLiters: item.physicalReturnedLiters.toFixed(3) })) })) })) } };
  }

  @UseGuards(SessionGuard)
  @Post("orders/:id/confirm")
  async confirmOrder(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Headers("idempotency-key") headerKey?: string) {
    const actor = requireActor(request); const key = requireIdempotencyKey(headerKey); const now = new Date(); const row = await this.prisma.salesOrder.findUnique({ where: { id }, include: { lines: true } }); if (!row) throw new NotFoundException("Order not found"); if (["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED", "FULFILLED"].includes(row.status)) return { data: { id, status: row.status, replay: true } }; if (row.status !== "DRAFT") throw new BadRequestException("Only draft orders can be confirmed");
    const updated = await this.prisma.$transaction(async (tx) => { for (const line of row.lines) { const unit = await tx.fuelUnitVersion.findFirst({ where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] }, orderBy: { effectiveFromUtc: "desc" } }); const price = await tx.priceVersion.findFirst({ where: { fuelId: line.fuelId, salesUnitId: line.salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] }, orderBy: { effectiveFromUtc: "desc" } }); if (!unit) throw new BadRequestException("Fuusto capacity is not configured for one or more lines"); if (!price) throw new BadRequestException("Price is not configured for one or more lines"); await tx.salesOrderLine.update({ where: { id: line.id }, data: { conversionVersionId: unit.id, litersPerUnitSnapshot: unit.litersPerUnit, requestedLitersSnapshot: line.requestedUnits.mul(unit.litersPerUnit), priceVersionId: price.id, unitPriceSnapshot: price.unitPrice, confirmedAt: now } }); } const claimed = await tx.salesOrder.updateMany({ where: { id, status: "DRAFT" }, data: { status: "CONFIRMED", confirmedAt: now, confirmedById: actor.id, confirmationIdempotencyKey: key } }); if (claimed.count !== 1) throw new BadRequestException("Order was already confirmed"); const saved = await tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { lines: true } }); await tx.orderEvent.create({ data: { orderId: id, kind: "CONFIRMED", newValues: { status: "CONFIRMED" }, actorId: actor.id } }); await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SalesOrder", entityId: id, action: "CONFIRMED" } }); return saved; }); return { data: { ...updated, lines: updated.lines.map((line) => ({ ...line, requestedUnits: line.requestedUnits.toFixed(3), requestedLitersSnapshot: jsonDecimal(line.requestedLitersSnapshot), litersPerUnitSnapshot: jsonDecimal(line.litersPerUnitSnapshot), unitPriceSnapshot: jsonDecimal(line.unitPriceSnapshot) })) } };
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
  async manifestPdf(@Param("id") id: string, @Res() response: Response) { const row = await this.prisma.deliverySheet.findUnique({ where: { id }, include: { lines: true } }); if (!row) throw new NotFoundException("Delivery sheet not found"); const chunks: Buffer[] = []; const doc = new PDFDocument({ autoFirstPage: true, info: { Title: "Daily delivery list", Author: "Fuel Wholesale System" } }); doc.on("data", (chunk: Buffer) => chunks.push(chunk)); doc.on("end", () => { response.type("application/pdf").send(Buffer.concat(chunks)); }); doc.fontSize(16).text("Daily Delivery List"); doc.fontSize(10).text(`Sheet ${row.sheetNo} — ${row.serviceDate.toISOString().slice(0, 10)}`); doc.moveDown(); for (const [index, line] of row.lines.entries()) { doc.text(`${index + 1}. ${line.orderNoSnapshot} | ${line.displayCustomerNameSnapshot} | ${line.phoneSnapshot ?? ""} | ${line.addressSnapshot} | ${line.fuelLabelSnapshot} | ${line.scheduledUnits.toFixed(3)} fuusto${line.instructions ? ` | ${line.instructions}` : ""}`); } doc.end(); }

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
}
