import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import { type Actor, hasPermission } from "./auth.js";
import { FinancialWorkflowsService } from "./financial-workflows.service.js";

type Tx = Prisma.TransactionClient;
export type SimpleOrderLineInput = { fuelId: string; salesUnitId: string; quantity: string; expectedPriceId: string };
export type SimpleOrderInput = { customerId: string; fuelId?: string; salesUnitId?: string; quantity?: string; expectedPriceId?: string; lines?: SimpleOrderLineInput[]; address: string; discount?: string; paidNow?: string; financialAccountId?: string; paymentMethod?: "CASH" | "BANK_TRANSFER" | "EVC_PLUS" | "EDAHAB" | "OTHER"; paymentReference?: string; notes?: string; requestedDeliveryDate?: string };
export type SimpleReceiptInput = { fuelId: string; quantity: string; date: string; supplier?: string; supplierId?: string; notes?: string; unitCost?: string; totalCost?: string; paidNow?: string; financialAccountId?: string };
export type SimplePaymentInput = { customerId: string; amount: string; financialAccountId?: string; method?: "CASH" | "BANK_TRANSFER" | "EVC_PLUS" | "EDAHAB" | "OTHER"; reference?: string; notes?: string; paymentDate?: string };
export type SimpleDeliveryInput = { orderId: string; lines: { orderLineId: string; acceptedUnits: string; remaining?: "RETURNED" | "IN_TRANSIT"; closeRemainder?: boolean; reason?: string; amendmentReason?: string }[] };
const d = (v: string) => new Prisma.Decimal(v);
const no = (prefix: string) => `${prefix}-${Date.now()}-${randomUUID().slice(0,8)}`;
function amount(value: unknown, field: string, zero = false) {
  if (typeof value !== "string" || !/^\d{1,14}(\.\d{1,4})?$/.test(value)) throw new BadRequestException(`${field}: enter a valid amount`);
  const result = d(value); if (zero ? result.lt(0) : result.lte(0)) throw new BadRequestException(`${field}: amount must be positive`); return result;
}
function quantity(value: unknown) { const result = amount(value, "Fuusto"); if (!result.isInteger()) throw new BadRequestException("Enter whole fuusto"); return result; }
function required(value: unknown, field: string) { if (typeof value !== "string" || !value.trim() || value.length > 2000) throw new BadRequestException(`${field} is required`); return value.trim(); }

@Injectable()
export class SimpleWorkflowsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(FinancialWorkflowsService) private readonly financial: FinancialWorkflowsService) {}

  // The request result is committed with its effects. A lost response can be replayed safely.
  async execute(actor: Actor, key: string | undefined, kind: string, input: object, work: (tx: Tx) => Promise<Prisma.InputJsonObject>) {
    if (!key || key.length < 12 || key.length > 180) throw new BadRequestException("Idempotency-Key is required");
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.db.$transaction(async tx => {
          const prior = await tx.workflowRequest.findUnique({ where: { key } });
          if (prior) {
            if (prior.actorId !== actor.id || prior.kind !== kind || prior.payloadHash !== hash) throw new ConflictException("This request key was used for a different operation");
            return { ...(prior.result as Prisma.JsonObject), replay: true } as Prisma.InputJsonObject;
          }
          const result = await work(tx);
          await tx.workflowRequest.create({ data: { key, actorId: actor.id, kind, payloadHash: hash, result } });
          return result;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      } catch (error) {
        if (attempt < 3 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
        throw error;
      }
    }
    throw new ConflictException("Please retry the operation");
  }

  private async audit(tx: Tx, actor: Actor, entityType: string, entityId: string, action: string) { await tx.auditEvent.create({ data: { actorId: actor.id, entityType, entityId, action } }); }
  private async ledger(tx: Tx, customerId: string, kind: "PAYMENT" | "INVOICE", referenceNo: string, sourceId: string, value: Prisma.Decimal) {
    const totals = await tx.customerLedgerEntry.aggregate({ where: { customerId }, _sum: { debitAmount: true, creditAmount: true } });
    const prior = (totals._sum.debitAmount ?? d("0")).sub(totals._sum.creditAmount ?? d("0"));
    await tx.customerLedgerEntry.create({ data: { customerId, entryType: kind, referenceNo, sourceId, sourceType: kind === "PAYMENT" ? "Payment" : "Invoice", debitAmount: kind === "INVOICE" ? value : d("0"), creditAmount: kind === "PAYMENT" ? value : d("0"), runningBalance: kind === "INVOICE" ? prior.add(value) : prior.sub(value) } });
  }
  private async collect(tx: Tx, actor: Actor, input: SimplePaymentInput, orderId?: string) {
    const value = amount(input.amount, "Payment");
    if (!await tx.customer.findUnique({ where: { id: required(input.customerId,"Customer") } })) throw new NotFoundException("Customer not found");
    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
    if (!Number.isFinite(paymentDate.getTime())) throw new BadRequestException("Enter a valid payment date");
    const financialAccountId = required(input.financialAccountId, "Financial account");
    const method = await this.financial.paymentMethod(tx, financialAccountId);
    const payment = await tx.payment.create({ data: { paymentNo: no("PAY"), customerId: input.customerId, orderId, amount: value, unappliedAmount: value, allocatedAmount: d("0"), paymentDate, paymentMethod: method as any, reference: input.reference?.trim() || null, notes: input.notes?.trim() || null, recordedById: actor.id, financialAccountId } });
    await this.financial.postMovement(tx, actor, { accountId: financialAccountId, direction: "MONEY_IN", kind: "CUSTOMER_PAYMENT", amount: value, occurredAt: paymentDate, sourceType: "Payment", sourceId: payment.id, referenceNo: payment.paymentNo, description: orderId ? "Paid Now for order" : "Customer debt payment" });
    await this.ledger(tx, input.customerId, "PAYMENT", payment.paymentNo, payment.id, value);
    if (!orderId) {
      const invoices = await tx.invoice.findMany({ where: { customerId: input.customerId, status: { in: ["UNPAID","PARTIALLY_PAID"] } }, orderBy: [{ issueDate:"asc" },{ id:"asc" }] });
      for (const invoice of invoices) await this.allocate(tx, actor, payment.id, invoice.id);
    }
    await this.audit(tx, actor,"Payment",payment.id,"RECORDED");
    return payment;
  }
  private async allocate(tx: Tx, actor: Actor, paymentId: string, invoiceId: string) {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (payment.status !== "POSTED" || payment.customerId !== invoice.customerId || !["UNPAID","PARTIALLY_PAID"].includes(invoice.status)) return;
    const value = Prisma.Decimal.min(payment.unappliedAmount, invoice.balanceDue);
    if (value.lte(0)) return;
    await tx.paymentAllocation.upsert({ where: { paymentId_invoiceId: { paymentId, invoiceId } }, create: { paymentId, invoiceId, amount: value, createdById: actor.id }, update: { amount: { increment: value } } });
    await tx.payment.update({ where: { id: paymentId }, data: { allocatedAmount: { increment: value }, unappliedAmount: { decrement: value } } });
    const balance = invoice.balanceDue.sub(value);
    await tx.invoice.update({ where: { id: invoiceId }, data: { paidAmount: { increment: value }, balanceDue: balance, status: balance.isZero() ? "PAID" : "PARTIALLY_PAID" } });
    await this.audit(tx,actor,"PaymentAllocation",paymentId,"ALLOCATED");
  }
  payment(actor: Actor, key: string | undefined, input: SimplePaymentInput) {
    return this.execute(actor,key,"payment",input,async tx => {
      const customerId = required(input.customerId, "Customer");
      const value = amount(input.amount, "Payment");
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException("Customer not found");
      const debt = await tx.invoice.aggregate({ where: { customerId, status: { in: ["UNPAID", "PARTIALLY_PAID"] } }, _sum: { balanceDue: true } });
      const openDebt = debt._sum.balanceDue ?? d("0");
      // Order-linked money is reserved for that order. Historical unlinked balances
      // require owner review and are never guessed into a new FIFO collection.
      const payable = Prisma.Decimal.max(d("0"), openDebt);
      if (payable.isZero()) throw new BadRequestException("No debt to pay");
      if (value.gt(payable)) throw new BadRequestException(`Debt is $${payable.toFixed(2)}. You cannot pay more.`);
      const p = await this.collect(tx, actor, { ...input, customerId, amount: value.toFixed(4) });
      return { id: p.id };
    });
  }

  async reversePayment(actor: Actor, key: string | undefined, paymentId: string, reasonInput: string | undefined) {
    if (actor.role !== "OWNER") throw new ForbiddenException("Only the owner can reverse a payment");
    const reason = required(reasonInput, "Reason");
    return this.execute(actor, key, "payment-reversal", { paymentId, reason }, async tx => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { allocations: { include: { invoice: true } }, reversals: true }
      });
      if (!payment) throw new NotFoundException("Payment not found");
      if (payment.status === "REVERSED") {
        return { id: payment.id, status: "REVERSED", replay: true };
      }

      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: "POSTED" },
        data: { status: "REVERSED", allocatedAmount: d("0"), unappliedAmount: d("0") }
      });
      if (claimed.count !== 1) return { id: payment.id, status: "REVERSED", replay: true };

      for (const allocation of payment.allocations) {
        const restoredPaid = Prisma.Decimal.max(d("0"), allocation.invoice.paidAmount.sub(allocation.amount));
        const restoredBalance = Prisma.Decimal.max(d("0"), allocation.invoice.totalAmount.sub(restoredPaid));
        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: restoredPaid,
            balanceDue: restoredBalance,
            status: restoredBalance.isZero() ? "PAID" : restoredPaid.gt(0) ? "PARTIALLY_PAID" : "UNPAID"
          }
        });
      }

      const reversal = await tx.paymentReversal.create({
        data: { reversalNo: no("PREV"), paymentId: payment.id, idempotencyKey: key!, reason, reversedById: actor.id }
      });
      if (payment.financialAccountId) {
        const originalMovement = await tx.financialAccountMovement.findFirst({ where: { sourceType: "Payment", sourceId: payment.id, kind: "CUSTOMER_PAYMENT" } });
        await this.financial.postMovement(tx, actor, { accountId: payment.financialAccountId, direction: "MONEY_OUT", kind: "CUSTOMER_PAYMENT_REVERSAL", amount: payment.amount, occurredAt: new Date(), sourceType: "PaymentReversal", sourceId: reversal.id, referenceNo: reversal.reversalNo, description: reason, reversalOfId: originalMovement?.id });
      }
      const totals = await tx.customerLedgerEntry.aggregate({ where: { customerId: payment.customerId }, _sum: { debitAmount: true, creditAmount: true } });
      const prior = (totals._sum.debitAmount ?? d("0")).sub(totals._sum.creditAmount ?? d("0"));
      await tx.customerLedgerEntry.create({
        data: {
          customerId: payment.customerId,
          entryType: "REVERSAL",
          referenceNo: reversal.reversalNo,
          debitAmount: payment.amount,
          creditAmount: d("0"),
          runningBalance: prior.add(payment.amount),
          sourceType: "PaymentReversal",
          sourceId: reversal.id,
          notes: reason
        }
      });
      await this.audit(tx, actor, "Payment", payment.id, "REVERSED");
      return { id: payment.id, status: "REVERSED", replay: false };
    });
  }

  receipt(actor: Actor, key: string | undefined, input: SimpleReceiptInput) {
    return this.execute(actor,key,"receipt",input,async tx => {
      const units = quantity(input.quantity); const liters = units.mul(240);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BadRequestException("Purchase date is required");
      const date = new Date(`${input.date}T12:00:00+03:00`); if (!Number.isFinite(date.getTime())) throw new BadRequestException("Invalid date");
      if ((input.unitCost || input.totalCost || input.supplierId || input.paidNow || input.financialAccountId) && actor.role !== "OWNER") throw new ForbiddenException("Supplier costs and payments are owner-only");
      const unit = input.unitCost ? amount(input.unitCost,"Unit cost") : input.totalCost ? amount(input.totalCost,"Total cost").div(units).toDecimalPlaces(4) : null;
      const total = input.totalCost ? amount(input.totalCost,"Total cost") : unit?.mul(units).toDecimalPlaces(4) ?? null;
      if (input.unitCost && input.totalCost && unit && total && unit.mul(units).sub(total).abs().gt("0.01")) throw new BadRequestException("Purchase costs do not match");
      if (total && !input.supplierId) throw new BadRequestException("Supplier is required when purchase cost is recorded");
      const paidNow = amount(input.paidNow || "0", "Paid now", true);
      if (paidNow.gt(0) && (!total || !input.financialAccountId)) throw new BadRequestException("Paid Now requires purchase cost and a financial account");
      if (total && paidNow.gt(total)) throw new BadRequestException("Paid Now cannot exceed the purchase total");
      const receipt = await tx.tankerReceipt.create({ data: { receiptNo:no("REC"), tankerReference:input.supplier, supplierId:input.supplierId || null, arrivedAt:date, notes:input.notes, status:"POSTED", createdById:actor.id, postedById:actor.id, postedAt:new Date(), postIdempotencyKey:key, lines:{create:{fuelId:input.fuelId, quantityFuusto:units, litersPerFuustoSnapshot:d("240"), actualLiters:liters, expectedLiters:liters, unitPurchaseCost:unit, totalPurchaseCost:total}} }, include:{lines:true} });
      if (total && unit && input.supplierId) {
        const purchase = await this.financial.createSupplierPurchase(tx, actor, { supplierId: input.supplierId, receiptId: receipt.id, fuelId: input.fuelId, quantityFuusto: units, unitCost: unit, totalCost: total, purchaseDate: date });
        if (paidNow.gt(0)) await this.financial.createSupplierPaymentInTransaction(tx, actor, `${key}:supplier`, { supplierId: input.supplierId, financialAccountId: required(input.financialAccountId, "Financial account"), amount: paidNow, paymentDate: date, reference: receipt.receiptNo, notes: "Paid with stock receipt", purchaseId: purchase.id });
      }
      await tx.stockBalance.upsert({where:{fuelId_location:{fuelId:input.fuelId,location:"WAREHOUSE"}},create:{fuelId:input.fuelId,location:"WAREHOUSE",balanceLiters:liters},update:{balanceLiters:{increment:liters},version:{increment:1}}});
      await tx.inventoryMovement.create({data:{fuelId:input.fuelId,location:"WAREHOUSE",signedDeltaLiters:liters,eventType:"RECEIPT",sourceType:"TankerReceiptLine",sourceId:receipt.id,sourceLineId:receipt.lines[0]!.id,createdById:actor.id}});
      await this.audit(tx,actor,"TankerReceipt",receipt.id,"POSTED");
      return {id:receipt.id,status:receipt.status};
    });
  }

  delivery(actor: Actor, key: string | undefined, input: SimpleDeliveryInput) {
    return this.execute(actor, key, "delivery", input, async tx => {
      const order = await tx.salesOrder.findUnique({
        where: { id: required(input.orderId, "Order") },
        include: { lines: { include: { dispatchLines: { include: { dispatch: true, confirmations: true } } } } }
      });
      if (!order) throw new NotFoundException("Order not found");
      if (!["CONFIRMED", "SCHEDULED", "IN_PROGRESS", "PARTIALLY_FULFILLED"].includes(order.status)) {
        throw new BadRequestException("Order is not awaiting delivery");
      }
      if (!Array.isArray(input.lines) || !input.lines.length || new Set(input.lines.map(l => l.orderLineId || (l as any).lineId)).size !== input.lines.length) {
        throw new BadRequestException("Select distinct order lines");
      }
      const invoiceIds: string[] = [];
      const orderRequestedGross = order.lines.reduce((sum, line) => sum.add(line.requestedUnits.mul(line.unitPriceSnapshot ?? d("0"))), d("0"));

      for (const entry of input.lines) {
        const line = order.lines.find(l => l.id === (entry.orderLineId || (entry as any).lineId));
        if (!line || !line.unitPriceSnapshot || !line.litersPerUnitSnapshot) throw new BadRequestException("Confirmed order line required");
        const accepted = amount(entry.acceptedUnits, "Accepted fuusto", true);
        if (!accepted.isInteger()) throw new BadRequestException("Enter whole fuusto");

        const posted = line.dispatchLines.filter(dl => ["POSTED", "PARTIALLY_RECONCILED", "RECONCILED"].includes(dl.dispatch.status));
        const acceptedBefore = posted.flatMap(dl => dl.confirmations).reduce((sum, c) => sum.add(c.acceptedUnits), d("0"));
        const effectiveOrdered = line.requestedUnits.add(line.amendedUnits).sub(line.cancelledUnits);
        const remainingOrder = Prisma.Decimal.max(d("0"), effectiveOrdered.sub(acceptedBefore));

        // Excess check (ORD-01)
        if (accepted.gt(remainingOrder)) {
          if (actor.role !== "OWNER" && !hasPermission(actor, "orders.delivery.overage_approve")) {
            throw new ForbiddenException("Ansixinta milkiilaha ayaa loo baahan yahay si loo kordhiyo tirada dalabka (Owner approval required for excess delivery quantity)");
          }
        }

        const active = posted.filter(dl => dl.dispatchedLiters.sub(dl.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"))).gt(0));
        if (active.length > 1) throw new BadRequestException("Multiple active deliveries: open the existing delivery details");
        let source = active[0];

        // If source dispatch exists: check in-transit available
        if (source) {
          const inTransitAvailable = source.dispatchedLiters.sub(source.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"))).div(source.litersPerUnitSnapshot);
          if (accepted.gt(inTransitAvailable)) {
            const extraUnits = accepted.sub(inTransitAvailable);
            const extraLiters = extraUnits.mul(source.litersPerUnitSnapshot);
            const moved = await tx.stockBalance.updateMany({
              where: { fuelId: line.fuelId, location: "WAREHOUSE", balanceLiters: { gte: extraLiters } },
              data: { balanceLiters: { decrement: extraLiters }, version: { increment: 1 } }
            });
            if (moved.count !== 1) throw new BadRequestException("Kaydka shidaalka kuma filna fuustada dheeraadka ah (Insufficient stock in warehouse for excess delivery)");
            await tx.stockBalance.upsert({
              where: { fuelId_location: { fuelId: line.fuelId, location: "IN_TRANSIT" } },
              create: { fuelId: line.fuelId, location: "IN_TRANSIT", balanceLiters: extraLiters },
              update: { balanceLiters: { increment: extraLiters }, version: { increment: 1 } }
            });
            await tx.dispatchLine.update({
              where: { id: source.id },
              data: { dispatchedUnits: { increment: extraUnits }, dispatchedLiters: { increment: extraLiters } }
            });
            for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
              await tx.inventoryMovement.create({
                data: {
                  fuelId: line.fuelId,
                  location,
                  signedDeltaLiters: location === "WAREHOUSE" ? extraLiters.neg() : extraLiters,
                  eventType: "DISPATCH",
                  sourceType: "DispatchLineExcess",
                  sourceId: source.dispatchId,
                  sourceLineId: `${source.id}:${key}`,
                  createdById: actor.id
                }
              });
            }
          }
        } else {
          // No prior dispatch: check if user provided disposition for partial
          if (line.dispatchLines.some(dl => dl.dispatch.status === "PREPARED")) {
            throw new BadRequestException("A prepared delivery already exists; open its details to avoid duplicate dispatch");
          }
          if (accepted.lt(remainingOrder) && !entry.closeRemainder && !["RETURNED", "IN_TRANSIT"].includes(entry.remaining ?? "")) {
            throw new BadRequestException("Dooro waxa ku dhacay shidaalka haray (Select what happened to the remaining fuel)");
          }
          const unitsToDispatch = ["RETURNED", "IN_TRANSIT"].includes(entry.remaining ?? "") ? remainingOrder : accepted;
          if (unitsToDispatch.gt(0)) {
            const liters = unitsToDispatch.mul(line.litersPerUnitSnapshot);
            const moved = await tx.stockBalance.updateMany({
              where: { fuelId: line.fuelId, location: "WAREHOUSE", balanceLiters: { gte: liters } },
              data: { balanceLiters: { decrement: liters }, version: { increment: 1 } }
            });
            if (moved.count !== 1) throw new BadRequestException("Kaydka shidaalka kuma filna (Insufficient stock in warehouse)");
            await tx.stockBalance.upsert({
              where: { fuelId_location: { fuelId: line.fuelId, location: "IN_TRANSIT" } },
              create: { fuelId: line.fuelId, location: "IN_TRANSIT", balanceLiters: liters },
              update: { balanceLiters: { increment: liters }, version: { increment: 1 } }
            });
            const dispatch = await tx.dispatch.create({
              data: {
                dispatchNo: no("DP"),
                status: "POSTED",
                dispatchedAt: new Date(),
                postedAt: new Date(),
                postedById: actor.id,
                idempotencyKey: `${key}:${line.id}`,
                lines: {
                  create: {
                    orderLineId: line.id,
                    dispatchedUnits: unitsToDispatch,
                    dispatchedLiters: liters,
                    litersPerUnitSnapshot: line.litersPerUnitSnapshot
                  }
                }
              },
              include: { lines: { include: { dispatch: true, confirmations: true } } }
            });
            source = dispatch.lines[0]!;
            for (const location of ["WAREHOUSE", "IN_TRANSIT"] as const) {
              await tx.inventoryMovement.create({
                data: {
                  fuelId: line.fuelId,
                  location,
                  signedDeltaLiters: location === "WAREHOUSE" ? liters.neg() : liters,
                  eventType: "DISPATCH",
                  sourceType: "DispatchLine",
                  sourceId: dispatch.id,
                  sourceLineId: source.id,
                  createdById: actor.id
                }
              });
            }
            await this.audit(tx, actor, "Dispatch", dispatch.id, "POSTED");
          }
        }

        // If excess was confirmed: update line's amendedUnits
        if (accepted.gt(remainingOrder)) {
          const excess = accepted.sub(remainingOrder);
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: {
              amendedUnits: { increment: excess },
              amendmentApprovedById: actor.id,
              amendmentApprovedAt: new Date(),
              amendmentReason: entry.amendmentReason?.trim() || entry.reason?.trim() || "Delivery overage approved"
            }
          });
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              lineId: line.id,
              kind: "AMENDED",
              newValues: { excessUnits: excess.toFixed(3), totalAccepted: accepted.toFixed(3) },
              actorId: actor.id,
              reason: entry.amendmentReason?.trim() || entry.reason?.trim() || "Delivery overage approved"
            }
          });
        }

        // If user is closing remainder with less (ORD-02)
        if (accepted.lt(remainingOrder) && entry.closeRemainder) {
          const unfulfilled = remainingOrder.sub(accepted);
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { cancelledUnits: { increment: unfulfilled } }
          });
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              lineId: line.id,
              kind: "REMAINDER_CANCELLED",
              newValues: { cancelledUnits: unfulfilled.toFixed(3) },
              actorId: actor.id,
              reason: entry.reason?.trim() || "Remainder cancelled upon partial delivery"
            }
          });
        }

        // If a source dispatch was active, calculate leftover in the truck
        let returnedLiters = d("0");
        if (source) {
          const currentDispatchedUnits = (await tx.dispatchLine.findUniqueOrThrow({ where: { id: source.id }, include: { confirmations: true } }));
          const settledLiters = currentDispatchedUnits.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"));
          const inTruckUnits = currentDispatchedUnits.dispatchedLiters.sub(settledLiters).div(source.litersPerUnitSnapshot);
          const leftoverInTruck = inTruckUnits.sub(accepted);
          if (leftoverInTruck.gt(0)) {
            if (!["RETURNED", "IN_TRANSIT"].includes(entry.remaining ?? "")) {
              throw new BadRequestException("Dooro in shidaalka haray uu bakhaarka ku soo noqday mise uu weli jidka ku jiro (Choose whether remaining fuel returned or is still in transit)");
            }
            if (entry.remaining === "RETURNED") {
              returnedLiters = leftoverInTruck.mul(source.litersPerUnitSnapshot);
            }
          }
        }

        const acceptedLiters = source ? accepted.mul(source.litersPerUnitSnapshot) : accepted.mul(line.litersPerUnitSnapshot);
        const disposition = entry.closeRemainder ? "CANCEL_REMAINDER" : returnedLiters.gt(0) ? "BACKORDER_REMAINDER" : "NONE";

        if (source) {
          const confirmation = await tx.deliveryConfirmation.create({
            data: {
              confirmationNo: no("DC"),
              dispatchId: source.dispatchId,
              confirmedAt: new Date(),
              recordedById: actor.id,
              idempotencyKey: `${key}:${line.id}`,
              lines: {
                create: {
                  dispatchLineId: source.id,
                  acceptedUnits: accepted,
                  acceptedLiters,
                  physicalReturnedLiters: returnedLiters,
                  commercialDisposition: disposition,
                  discrepancyReason: entry.reason,
                  billingSourceKey: `simple:${key}:${line.id}`
                }
              }
            },
            include: { lines: true }
          });
          const confirmed = confirmation.lines[0]!;
          const transitOut = acceptedLiters.add(returnedLiters);
          if (transitOut.gt(0)) {
            const changed = await tx.stockBalance.updateMany({
              where: { fuelId: line.fuelId, location: "IN_TRANSIT", balanceLiters: { gte: transitOut } },
              data: { balanceLiters: { decrement: transitOut }, version: { increment: 1 } }
            });
            if (changed.count !== 1) throw new BadRequestException("Insufficient fuel in transit");
            if (acceptedLiters.gt(0)) {
              await tx.inventoryMovement.create({
                data: {
                  fuelId: line.fuelId,
                  location: "IN_TRANSIT",
                  signedDeltaLiters: acceptedLiters.neg(),
                  eventType: "ACCEPTED",
                  sourceType: "DeliveryConfirmationLine",
                  sourceId: confirmation.id,
                  sourceLineId: confirmed.id,
                  createdById: actor.id
                }
              });
            }
            if (returnedLiters.gt(0)) {
              await tx.stockBalance.update({
                where: { fuelId_location: { fuelId: line.fuelId, location: "WAREHOUSE" } },
                data: { balanceLiters: { increment: returnedLiters }, version: { increment: 1 } }
              });
              for (const loc of ["WAREHOUSE", "IN_TRANSIT"] as const) {
                await tx.inventoryMovement.create({
                  data: {
                    fuelId: line.fuelId,
                    location: loc,
                    signedDeltaLiters: loc === "WAREHOUSE" ? returnedLiters : returnedLiters.neg(),
                    eventType: "RETURN",
                    sourceType: "DeliveryConfirmationLine",
                    sourceId: confirmation.id,
                    sourceLineId: confirmed.id,
                    createdById: actor.id
                  }
                });
              }
            }
          }

          const allDispatchLines = await tx.dispatchLine.findMany({ where: { dispatchId: source.dispatchId }, include: { confirmations: true } });
          const hasTransit = allDispatchLines.some(dl => dl.dispatchedLiters.gt(dl.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"))));
          await tx.dispatch.update({ where: { id: source.dispatchId }, data: { status: hasTransit ? "PARTIALLY_RECONCILED" : "RECONCILED" } });
          await this.audit(tx, actor, "DeliveryConfirmation", confirmation.id, "POSTED");

          if (accepted.gt(0)) {
            const previous = await tx.invoice.aggregate({ where: { lines: { some: { orderLine: { orderId: order.id } } } }, _sum: { discountAmount: true } });
            const remainingDiscount = Prisma.Decimal.max(0, order.fixedDiscountAmount.sub(previous._sum.discountAmount ?? d("0")));
            const subtotal = accepted.mul(line.unitPriceSnapshot).toDecimalPlaces(4);
            const lineAcceptedGross = accepted.mul(line.unitPriceSnapshot);
            const proportionalDiscount = orderRequestedGross.isZero()
              ? d("0")
              : order.fixedDiscountAmount.mul(lineAcceptedGross).div(orderRequestedGross).toDecimalPlaces(4);
            const discount = Prisma.Decimal.min(
              subtotal,
              remainingDiscount,
              proportionalDiscount
            );
            const total = subtotal.sub(discount);
            const invoice = await tx.invoice.create({
              data: {
                invoiceNo: no("INV"),
                customerId: order.customerId,
                deliveryConfirmationLineId: confirmed.id,
                billingSourceKey: confirmed.billingSourceKey,
                issueDate: new Date(),
                status: total.isZero() ? "PAID" : "UNPAID",
                subtotal,
                discountAmount: discount,
                taxAmount: d("0"),
                totalAmount: total,
                paidAmount: d("0"),
                balanceDue: total,
                currencyCode: line.currencyCode,
                createdById: actor.id,
                lines: {
                  create: {
                    orderLineId: line.id,
                    fuelId: line.fuelId,
                    salesUnitId: line.salesUnitId,
                    acceptedUnits: accepted,
                    acceptedLiters,
                    unitPriceSnapshot: line.unitPriceSnapshot,
                    litersPerUnitSnapshot: line.litersPerUnitSnapshot,
                    lineTotal: subtotal
                  }
                }
              }
            });
            await this.ledger(tx, order.customerId, "INVOICE", invoice.invoiceNo, invoice.id, total);
            const credits = await tx.payment.findMany({ where: { orderId: order.id, customerId: order.customerId, status: "POSTED", unappliedAmount: { gt: 0 } }, orderBy: [{ paymentDate: "asc" }, { id: "asc" }] });
            for (const credit of credits) await this.allocate(tx, actor, credit.id, invoice.id);
            await this.audit(tx, actor, "Invoice", invoice.id, "POSTED");
            invoiceIds.push(invoice.id);
          }
        }
      }

      // Re-evaluate order status
      const updatedLines = await tx.salesOrderLine.findMany({
        where: { orderId: order.id },
        include: { dispatchLines: { include: { confirmations: true } } }
      });
      const allFulfilled = updatedLines.every(l => {
        const netOrdered = l.requestedUnits.add(l.amendedUnits).sub(l.cancelledUnits);
        const totalAccepted = l.dispatchLines.flatMap(dl => dl.confirmations).reduce((sum, c) => sum.add(c.acceptedUnits), d("0"));
        return totalAccepted.gte(netOrdered);
      });
      const anyAcceptedOrCancelled = updatedLines.some(l => {
        const totalAccepted = l.dispatchLines.flatMap(dl => dl.confirmations).reduce((sum, c) => sum.add(c.acceptedUnits), d("0"));
        return totalAccepted.gt(0) || l.cancelledUnits.gt(0);
      });
      const status = allFulfilled ? "FULFILLED" : anyAcceptedOrCancelled ? "PARTIALLY_FULFILLED" : "IN_PROGRESS";
      await tx.salesOrder.update({ where: { id: order.id }, data: { status } });
      await tx.orderEvent.create({ data: { orderId: order.id, kind: "DELIVERY_RECONCILED", newValues: { status }, actorId: actor.id } });
      return { id: order.id, status, invoiceIds };
    });
  }

  async cancelOrder(actor: Actor, key: string | undefined, orderId: string, reasonInput: string | undefined) {
    if (actor.role !== "OWNER" && !hasPermission(actor, "orders.cancel")) {
      throw new ForbiddenException("Ogolaansho uma haysatid inaad joojiso dalabka (Permission denied to cancel order)");
    }
    const reason = required(reasonInput, "Sababta (Reason)");
    return this.execute(actor, key, "order-cancel", { orderId, reason }, async tx => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              dispatchLines: {
                include: { dispatch: true, confirmations: true }
              }
            }
          },
          payments: true
        }
      });
      if (!order) throw new NotFoundException("Order not found");
      if (order.status === "CANCELLED") {
        return { id: order.id, status: "CANCELLED", replay: true };
      }
      if (order.status === "FULFILLED") {
        throw new BadRequestException("Dalabkan waa la dhammaystiray, lama baabi'in karo (Completed order cannot be cancelled)");
      }
      if (order.status === "PARTIALLY_FULFILLED") {
        throw new BadRequestException("Dalabkan qeyb ahaan waa la geeyey. Isticmaal 'Jooji inta Harsan' si aad u joojiso inta aan la gaarsiin (Use Cancel Remainder for partially fulfilled orders)");
      }

      // Check if any dispatches have unreturned fuel in transit
      for (const line of order.lines) {
        for (const dl of line.dispatchLines) {
          if (["POSTED", "PARTIALLY_RECONCILED"].includes(dl.dispatch.status)) {
            const settled = dl.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"));
            if (dl.dispatchedLiters.gt(settled)) {
              throw new BadRequestException("Dalabkan shidaal ayaa jidka ugu jira. Marka hore soo celi shidaalka jidka ku jira (Fuel is currently in transit. Reconcile or return in-transit fuel before cancelling).");
            }
          }
        }
      }

      // Check if any posted invoices exist
      const invoiceCount = await tx.invoice.count({
        where: { lines: { some: { orderLine: { orderId: order.id } } } }
      });
      if (invoiceCount > 0) {
        throw new BadRequestException("Dalabkan waxaa ku xiran qaansheegyo la soo saaray. Lama baabi'in karo (Order has posted invoices).");
      }

      // Any prepared dispatches: delete them
      const preparedDispatches = await tx.dispatch.findMany({
        where: { status: "PREPARED", lines: { some: { orderLine: { orderId: order.id } } } }
      });
      for (const disp of preparedDispatches) {
        await tx.dispatchLine.deleteMany({ where: { dispatchId: disp.id } });
        await tx.dispatch.delete({ where: { id: disp.id } });
      }

      // Update order status to CANCELLED
      const now = new Date();
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancellationReason: reason,
          cancelledById: actor.id,
          cancelledAt: now
        }
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          kind: "CANCELLED",
          newValues: { status: "CANCELLED", reason },
          actorId: actor.id,
          reason
        }
      });

      await this.audit(tx, actor, "SalesOrder", order.id, "CANCELLED");
      return { id: order.id, status: "CANCELLED", replay: false };
    });
  }

  async cancelRemainder(actor: Actor, key: string | undefined, orderId: string, reasonInput: string | undefined) {
    if (actor.role !== "OWNER" && !hasPermission(actor, "orders.cancel")) {
      throw new ForbiddenException("Ogolaansho uma haysatid inaad joojiso inta harsan (Permission denied to cancel remainder)");
    }
    const reason = required(reasonInput, "Sababta (Reason)");
    return this.execute(actor, key, "order-cancel-remainder", { orderId, reason }, async tx => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: {
            include: {
              dispatchLines: {
                include: { dispatch: true, confirmations: true }
              }
            }
          }
        }
      });
      if (!order) throw new NotFoundException("Order not found");
      if (["FULFILLED", "CANCELLED"].includes(order.status)) {
        throw new BadRequestException(`Cannot cancel remainder for order in status ${order.status}`);
      }

      // Check if any in-transit fuel is pending
      for (const line of order.lines) {
        for (const dl of line.dispatchLines) {
          if (["POSTED", "PARTIALLY_RECONCILED"].includes(dl.dispatch.status)) {
            const settled = dl.confirmations.reduce((sum, c) => sum.add(c.acceptedLiters).add(c.physicalReturnedLiters), d("0"));
            if (dl.dispatchedLiters.gt(settled)) {
              throw new BadRequestException("Shidaal ayaa weli jidka ku jira. Marka hore soo celi shidaalka (Fuel is in transit. Reconcile delivery before cancelling remainder).");
            }
          }
        }
      }

      let totalCancelledUnits = d("0");
      for (const line of order.lines) {
        const accepted = line.dispatchLines.flatMap(dl => dl.confirmations).reduce((sum, c) => sum.add(c.acceptedUnits), d("0"));
        const netOrdered = line.requestedUnits.add(line.amendedUnits).sub(line.cancelledUnits);
        const unfulfilled = Prisma.Decimal.max(d("0"), netOrdered.sub(accepted));
        if (unfulfilled.gt(0)) {
          await tx.salesOrderLine.update({
            where: { id: line.id },
            data: { cancelledUnits: { increment: unfulfilled } }
          });
          totalCancelledUnits = totalCancelledUnits.add(unfulfilled);
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              lineId: line.id,
              kind: "REMAINDER_CANCELLED",
              newValues: { cancelledUnits: unfulfilled.toFixed(3) },
              actorId: actor.id,
              reason
            }
          });
        }
      }

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: "FULFILLED" }
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          kind: "ORDER_CLOSED_WITH_LESS",
          newValues: { status: "FULFILLED", totalCancelledUnits: totalCancelledUnits.toFixed(3) },
          actorId: actor.id,
          reason
        }
      });

      await this.audit(tx, actor, "SalesOrder", order.id, "REMAINDER_CANCELLED");
      return { id: order.id, status: "FULFILLED", totalCancelledUnits: totalCancelledUnits.toFixed(3), replay: false };
    });
  }


  order(actor: Actor, key: string | undefined, input: SimpleOrderInput) {
    return this.execute(actor, key, "order", input, async tx => {
      const inputLines: SimpleOrderLineInput[] = input.lines && input.lines.length > 0
        ? input.lines
        : [{
            fuelId: required(input.fuelId, "Fuel"),
            salesUnitId: required(input.salesUnitId, "Unit"),
            quantity: required(input.quantity, "Quantity"),
            expectedPriceId: required(input.expectedPriceId, "Price")
          }];

      if (inputLines.length === 0 || inputLines.length > 2) {
        throw new BadRequestException("Order must have 1 or 2 fuel lines");
      }
      const fuelIds = inputLines.map(l => required(l.fuelId, "Fuel"));
      if (new Set(fuelIds).size !== fuelIds.length) {
        throw new BadRequestException("A single order cannot contain duplicate fuel lines");
      }

      const customer = await tx.customer.findUnique({ where: { id: required(input.customerId, "Customer") } });
      if (!customer || customer.status !== "ACTIVE") throw new BadRequestException("Customer account is not active");

      const now = new Date();
      const resolvedLines = [];
      let subtotal = d("0");

      for (const lineInput of inputLines) {
        const units = quantity(lineInput.quantity);
        const salesUnitId = required(lineInput.salesUnitId, "Unit");
        const where = { fuelId: lineInput.fuelId, salesUnitId, effectiveFromUtc: { lte: now }, OR: [{ effectiveToUtc: null }, { effectiveToUtc: { gt: now } }] };
        const price = await tx.priceVersion.findFirst({ where, orderBy: { effectiveFromUtc: "desc" } });
        const conversion = await tx.fuelUnitVersion.findFirst({ where, orderBy: { effectiveFromUtc: "desc" } });
        if (!price || !conversion || !conversion.litersPerUnit.eq(240)) throw new BadRequestException("Current price and 240 L fuusto must be configured for all ordered fuels");
        if (price.id !== lineInput.expectedPriceId) throw new ConflictException("Qiimaha ayaa isbeddelay. Dib u eeg qiimaha cusub (Price changed; review the current price).");

        const lineSubtotal = units.mul(price.unitPrice);
        subtotal = subtotal.add(lineSubtotal);
        resolvedLines.push({
          fuelId: lineInput.fuelId,
          salesUnitId,
          units,
          price,
          conversion,
          lineSubtotal
        });
      }

      const discount = amount(input.discount || "0", "Discount", true);
      const paid = amount(input.paidNow || "0", "Paid now", true);

      if (discount.gt(subtotal)) throw new BadRequestException("Discount exceeds order total");
      const netTotal = subtotal.sub(discount);
      if (paid.gt(netTotal)) throw new BadRequestException(`Order total is $${netTotal.toFixed(2)}. Paid now cannot be higher.`);
      if (customer.creditLimit !== null) {
        const debt = await tx.invoice.aggregate({ where: { customerId: customer.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } }, _sum: { balanceDue: true } });
        if ((debt._sum.balanceDue ?? d("0")).add(netTotal).gt(customer.creditLimit)) throw new BadRequestException("Customer credit limit exceeded");
      }
      const pending = discount.gt(0) && actor.role !== "OWNER";
      const deliveryDate = input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : null;

      const order = await tx.salesOrder.create({
        data: {
          orderNo: no("SO"),
          customerId: customer.id,
          orderDate: now,
          requestedDeliveryDate: deliveryDate,
          addressSnapshot: required(input.address, "Address"),
          notes: input.notes,
          createdById: actor.id,
          status: pending ? "DRAFT" : "CONFIRMED",
          confirmedAt: pending ? null : now,
          confirmedById: pending ? null : actor.id,
          confirmationIdempotencyKey: pending ? null : key,
          subtotal: pending ? null : subtotal,
          totalAmount: pending ? null : netTotal,
          fixedDiscountAmount: discount,
          discountApprovedById: discount.gt(0) && !pending ? actor.id : null,
          discountApprovedAt: discount.gt(0) && !pending ? now : null,
          lines: {
            create: resolvedLines.map(l => ({
              fuelId: l.fuelId,
              salesUnitId: l.salesUnitId,
              requestedUnits: l.units,
              conversionVersionId: pending ? null : l.conversion.id,
              litersPerUnitSnapshot: pending ? null : d("240"),
              requestedLitersSnapshot: pending ? null : l.units.mul(240),
              priceVersionId: pending ? null : l.price.id,
              unitPriceSnapshot: pending ? null : l.price.unitPrice,
              confirmedAt: pending ? null : now
            }))
          }
        }
      });

      if (paid.gt(0)) {
        await this.collect(tx, actor, { customerId: customer.id, amount: paid.toFixed(4), financialAccountId: input.financialAccountId, method: input.paymentMethod, reference: input.paymentReference }, order.id);
      }
      await tx.orderEvent.create({ data: { orderId: order.id, kind: pending ? "DISCOUNT_REQUESTED" : "CONFIRMED", newValues: { status: order.status, fixedDiscountAmount: discount.toFixed(4) }, actorId: actor.id } });
      await this.audit(tx, actor, "SalesOrder", order.id, pending ? "DISCOUNT_REQUESTED" : "CONFIRMED");
      return { id: order.id, status: order.status };
    });
  }

  async keepExcessCredit(actor: Actor, key: string | undefined, orderId: string) {
    if (actor.role !== "OWNER" && !hasPermission(actor, "orders.create") && !hasPermission(actor, "payments.record")) {
      throw new ForbiddenException("Keliya milkiilaha ama shaqaalaha la oggolaaday ayaa go'aamin kara hadhaaga dalabka");
    }
    return this.execute(actor, key, "excess-credit-keep", { orderId }, async tx => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { payments: { where: { status: "POSTED", unappliedAmount: { gt: 0 } } } }
      });
      if (!order) throw new NotFoundException("Dalabka lama helin");
      if (!order.payments.length) throw new BadRequestException("Dalabkan ma laha lacag hadhaa ah");

      let totalKept = d("0");
      for (const p of order.payments) {
        totalKept = totalKept.add(p.unappliedAmount);
        await tx.payment.update({
          where: { id: p.id },
          data: { orderId: null }
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "SalesOrder",
          entityId: order.id,
          action: "EXCESS_CREDIT_KEPT",
          reason: `Excess Paid Now credit of $${totalKept.toFixed(2)} retained as general customer credit`
        }
      });

      return { orderId, status: "CREDIT_KEPT", totalKept: totalKept.toFixed(4) };
    });
  }

  async refundExcessCredit(
    actor: Actor,
    key: string | undefined,
    orderId: string,
    input: { financialAccountId: string; amount?: string; reason?: string }
  ) {
    if (actor.role !== "OWNER" && !hasPermission(actor, "payments.reverse") && !hasPermission(actor, "orders.create")) {
      throw new ForbiddenException("Keliya milkiilaha ama shaqaalaha la oggolaaday ayaa lacag celin kara");
    }
    const accountId = required(input.financialAccountId, "Akoonka lacagta celinta");
    const reason = required(input.reason || "Excess Paid Now refunded to customer", "Sababta celinta");

    return this.execute(actor, key, "excess-credit-refund", { orderId, accountId, ...input }, async tx => {
      const order = await tx.salesOrder.findUnique({
        where: { id: orderId },
        include: { payments: { where: { status: "POSTED", unappliedAmount: { gt: 0 } } } }
      });
      if (!order) throw new NotFoundException("Dalabka lama helin");
      if (!order.payments.length) throw new BadRequestException("Dalabkan ma laha lacag hadhaa ah oo la celiyo");

      const totalUnapplied = order.payments.reduce((sum, p) => sum.add(p.unappliedAmount), d("0"));
      const refundVal = input.amount ? amount(input.amount, "Lacagta la celinayo") : totalUnapplied;
      if (refundVal.gt(totalUnapplied)) {
        throw new BadRequestException(`Lacagta la celinayo ($${refundVal.toFixed(2)}) kama badnaan karto hadhaaga ($${totalUnapplied.toFixed(2)})`);
      }

      let remainingToRefund = refundVal;
      for (const p of order.payments) {
        if (remainingToRefund.lte(0)) break;
        const slice = Prisma.Decimal.min(remainingToRefund, p.unappliedAmount);
        await tx.payment.update({
          where: { id: p.id },
          data: {
            unappliedAmount: p.unappliedAmount.sub(slice)
          }
        });
        remainingToRefund = remainingToRefund.sub(slice);
      }

      const refund = await tx.customerRefund.create({
        data: {
          refundNo: no("REF"),
          orderId: order.id,
          customerId: order.customerId,
          financialAccountId: accountId,
          amount: refundVal,
          reason,
          createdById: actor.id
        }
      });

      await this.financial.postMovement(tx, actor, {
        accountId,
        direction: "MONEY_OUT",
        kind: "CUSTOMER_REFUND",
        amount: refundVal,
        occurredAt: new Date(),
        sourceType: "CustomerRefund",
        sourceId: refund.id,
        referenceNo: refund.refundNo,
        description: reason
      });

      const totals = await tx.customerLedgerEntry.aggregate({ where: { customerId: order.customerId }, _sum: { debitAmount: true, creditAmount: true } });
      const prior = (totals._sum.debitAmount ?? d("0")).sub(totals._sum.creditAmount ?? d("0"));
      await tx.customerLedgerEntry.create({
        data: {
          customerId: order.customerId,
          entryType: "ADJUSTMENT",
          referenceNo: refund.refundNo,
          debitAmount: refundVal,
          creditAmount: d("0"),
          runningBalance: prior.add(refundVal),
          sourceType: "CustomerRefund",
          sourceId: refund.id,
          notes: reason
        }
      });

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          entityType: "CustomerRefund",
          entityId: refund.id,
          action: "POSTED",
          reason: `Refunded $${refundVal.toFixed(2)} from account ${accountId}: ${reason}`
        }
      });

      return { orderId, refundId: refund.id, refundNo: refund.refundNo, status: "REFUNDED", refundedAmount: refundVal.toFixed(4) };
    });
  }
}
