import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import type { Actor } from "./auth.js";

type Tx = Prisma.TransactionClient;
type Direction = "MONEY_IN" | "MONEY_OUT";
type Kind = "OPENING_BALANCE" | "CUSTOMER_PAYMENT" | "CUSTOMER_PAYMENT_REVERSAL" | "SUPPLIER_PAYMENT" | "SUPPLIER_PAYMENT_REVERSAL" | "EXPENSE" | "EXPENSE_REVERSAL" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT";
const dec = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const documentNo = (prefix: string) => `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;

function text(value: unknown, field: string, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new BadRequestException(`${field} is required`);
  return value.trim();
}
function optionalText(value: unknown, max = 1000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim().length > max) throw new BadRequestException("Enter valid text");
  return value.trim() || null;
}
function money(value: unknown, field: string, allowZero = false) {
  if (typeof value !== "string" || !/^\-?\d{1,14}(\.\d{1,4})?$/.test(value)) throw new BadRequestException(`${field}: enter a valid amount`);
  const result = dec(value);
  if (allowZero ? result.lt(0) : result.lte(0)) throw new BadRequestException(`${field}: amount must be positive`);
  return result;
}
function dateValue(value: unknown, field: string) {
  if (typeof value !== "string" || !value) throw new BadRequestException(`${field} is required`);
  const result = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+03:00`) : new Date(value);
  if (!Number.isFinite(result.getTime())) throw new BadRequestException(`${field}: enter a valid date`);
  return result;
}

@Injectable()
export class FinancialWorkflowsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  private owner(actor: Actor) {
    if (actor.role !== "OWNER") throw new ForbiddenException("Owner permission required");
  }

  private async execute(actor: Actor, key: string | undefined, kind: string, input: object, work: (tx: Tx) => Promise<Prisma.InputJsonObject>) {
    if (!key || key.length < 12 || key.length > 180) throw new BadRequestException("Idempotency-Key is required");
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
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

  async postMovement(tx: Tx, actor: Actor, input: { accountId: string; direction: Direction; kind: Kind; amount: Prisma.Decimal; occurredAt: Date; sourceType: string; sourceId: string; referenceNo: string; description?: string; reversalOfId?: string }) {
    const account = await tx.financialAccount.findUnique({ where: { id: input.accountId } });
    if (!account || !account.active) throw new BadRequestException("Select an active financial account");
    if (actor.role === "OFFICE_EMPLOYEE" && !account.allowOfficePayments) throw new ForbiddenException("This account is not available for office payments");
    const existing = await tx.financialAccountMovement.findUnique({ where: { accountId_sourceType_sourceId_kind: { accountId: account.id, sourceType: input.sourceType, sourceId: input.sourceId, kind: input.kind } } });
    if (existing) return existing;
    const next = input.direction === "MONEY_IN" ? account.currentBalance.add(input.amount) : account.currentBalance.sub(input.amount);
    if (input.direction === "MONEY_OUT") {
      if (account.overdraftPolicy === "UNSET") throw new BadRequestException("Owner must set this account's negative-balance policy first");
      if (account.overdraftPolicy === "BLOCK_NEGATIVE" && next.lt(0)) throw new BadRequestException("Account balance is too low for this payment");
    }
    await tx.financialAccount.update({ where: { id: account.id }, data: { currentBalance: next } });
    return tx.financialAccountMovement.create({ data: { accountId: account.id, occurredAt: input.occurredAt, direction: input.direction, kind: input.kind, amount: input.amount, balanceAfter: next, sourceType: input.sourceType, sourceId: input.sourceId, referenceNo: input.referenceNo, description: input.description, createdById: actor.id, reversalOfId: input.reversalOfId } });
  }

  async selectableAccounts(actor: Actor) {
    const rows = await this.db.financialAccount.findMany({ where: { active: true, ...(actor.role === "OFFICE_EMPLOYEE" ? { allowOfficePayments: true } : {}) }, orderBy: { name: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      identifierMasked: row.identifierMasked,
      currentBalance: actor.role === "OWNER" ? row.currentBalance.toFixed(4) : null,
      overdraftPolicy: actor.role === "OWNER" ? row.overdraftPolicy : null
    }));
  }

  async accounts(actor: Actor) {
    this.owner(actor);
    const rows = await this.db.financialAccount.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { movements: true } } } });
    return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, type: row.type, identifierMasked: row.identifierMasked, currencyCode: row.currencyCode, openingBalance: row.openingBalance.toFixed(4), openingBalanceAsOf: row.openingBalanceAsOf.toISOString(), currentBalance: row.currentBalance.toFixed(4), overdraftPolicy: row.overdraftPolicy, allowOfficePayments: row.allowOfficePayments, active: row.active, movementCount: row._count.movements }));
  }

  createAccount(actor: Actor, key: string | undefined, input: { name?: string; type?: string; identifierMasked?: string; openingBalance?: string; openingBalanceAsOf?: string; overdraftPolicy?: string; allowOfficePayments?: boolean; notes?: string }) {
    this.owner(actor);
    return this.execute(actor, key, "financial-account-create", input, async (tx) => {
      const name = text(input.name, "Account name", 120);
      if (!input.type || !["CASH", "MOBILE_MONEY", "BANK", "OTHER"].includes(input.type)) throw new BadRequestException("Select an account type");
      if (!input.overdraftPolicy || !["BLOCK_NEGATIVE", "ALLOW_NEGATIVE"].includes(input.overdraftPolicy)) throw new BadRequestException("Choose the negative-balance policy");
      const opening = money(input.openingBalance ?? "", "Opening balance", true);
      if (opening.lt(0) && input.overdraftPolicy !== "ALLOW_NEGATIVE") throw new BadRequestException("A negative opening balance requires Allow negative balance");
      const account = await tx.financialAccount.create({ data: { code: documentNo("ACC"), name, type: input.type as "CASH" | "MOBILE_MONEY" | "BANK" | "OTHER", identifierMasked: optionalText(input.identifierMasked, 120), openingBalance: opening, openingBalanceAsOf: dateValue(input.openingBalanceAsOf, "Opening balance date"), currentBalance: opening, overdraftPolicy: input.overdraftPolicy as "BLOCK_NEGATIVE" | "ALLOW_NEGATIVE", allowOfficePayments: input.allowOfficePayments !== false, notes: optionalText(input.notes), createdById: actor.id } });
      await tx.financialAccountMovement.create({ data: { accountId: account.id, occurredAt: account.openingBalanceAsOf, direction: opening.lt(0) ? "MONEY_OUT" : "MONEY_IN", kind: "OPENING_BALANCE", amount: opening.abs(), balanceAfter: opening, sourceType: "FinancialAccount", sourceId: account.id, referenceNo: account.code, description: "Owner-entered opening balance", createdById: actor.id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "FinancialAccount", entityId: account.id, action: "CREATED" } });
      return { id: account.id };
    });
  }

  async accountDetail(actor: Actor, id: string) {
    this.owner(actor);
    const row = await this.db.financialAccount.findUnique({ where: { id }, include: { movements: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 250 } } });
    if (!row) throw new NotFoundException("Account not found");
    return { id: row.id, name: row.name, currentBalance: row.currentBalance.toFixed(4), movements: row.movements.map((m) => ({ id: m.id, occurredAt: m.occurredAt.toISOString(), direction: m.direction, kind: m.kind, amount: m.amount.toFixed(4), balanceAfter: m.balanceAfter.toFixed(4), referenceNo: m.referenceNo, description: m.description, sourceType: m.sourceType, sourceId: m.sourceId })) };
  }

  updateAccount(actor: Actor, id: string, input: { name?: string; identifierMasked?: string; overdraftPolicy?: string; allowOfficePayments?: boolean; active?: boolean }) {
    this.owner(actor);
    if (input.overdraftPolicy !== undefined && !["BLOCK_NEGATIVE", "ALLOW_NEGATIVE"].includes(input.overdraftPolicy)) throw new BadRequestException("Choose a valid negative-balance policy");
    return this.db.financialAccount.update({ where: { id }, data: { ...(input.name === undefined ? {} : { name: text(input.name, "Account name", 120) }), ...(input.identifierMasked === undefined ? {} : { identifierMasked: optionalText(input.identifierMasked, 120) }), ...(input.overdraftPolicy === undefined ? {} : { overdraftPolicy: input.overdraftPolicy as "BLOCK_NEGATIVE" | "ALLOW_NEGATIVE" }), ...(input.allowOfficePayments === undefined ? {} : { allowOfficePayments: input.allowOfficePayments }), ...(input.active === undefined ? {} : { active: input.active }) } });
  }

  transfer(actor: Actor, key: string | undefined, input: { fromAccountId?: string; toAccountId?: string; amount?: string; transferDate?: string; reference?: string; notes?: string }) {
    this.owner(actor);
    return this.execute(actor, key, "account-transfer", input, async (tx) => {
      const fromId = text(input.fromAccountId, "From account"); const toId = text(input.toAccountId, "To account");
      if (fromId === toId) throw new BadRequestException("Choose two different accounts");
      const value = money(input.amount, "Transfer amount"); const at = dateValue(input.transferDate, "Transfer date");
      const transfer = await tx.accountTransfer.create({ data: { transferNo: documentNo("TRF"), fromAccountId: fromId, toAccountId: toId, amount: value, transferDate: at, reference: optionalText(input.reference, 200), notes: optionalText(input.notes), idempotencyKey: key!, createdById: actor.id } });
      const outgoing = await this.postMovement(tx, actor, { accountId: fromId, direction: "MONEY_OUT", kind: "TRANSFER_OUT", amount: value, occurredAt: at, sourceType: "AccountTransfer", sourceId: transfer.id, referenceNo: transfer.transferNo, description: `Transfer to account ${toId}` });
      await this.postMovement(tx, actor, { accountId: toId, direction: "MONEY_IN", kind: "TRANSFER_IN", amount: value, occurredAt: at, sourceType: "AccountTransfer", sourceId: transfer.id, referenceNo: transfer.transferNo, description: `Transfer from account ${fromId}` });
      return { id: transfer.id, movementId: outgoing.id };
    });
  }

  async suppliers(actor: Actor) {
    this.owner(actor);
    const rows = await this.db.supplier.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], include: { purchases: { where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } }, select: { balanceDue: true } } } });
    return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, phone: row.phone, location: row.location, notes: row.notes, status: row.status, debt: row.purchases.reduce((sum, p) => sum.add(p.balanceDue), dec(0)).toFixed(4) }));
  }

  createSupplier(actor: Actor, input: { name?: string; phone?: string; location?: string; notes?: string }) {
    this.owner(actor);
    return this.db.$transaction(async (tx) => {
      const row = await tx.supplier.create({ data: { code: documentNo("SUP"), name: text(input.name, "Supplier name", 160), phone: optionalText(input.phone, 80), location: optionalText(input.location, 200), notes: optionalText(input.notes), createdById: actor.id } });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Supplier", entityId: row.id, action: "CREATED" } });
      return { id: row.id };
    });
  }

  updateSupplier(actor: Actor, id: string, input: { name?: string; phone?: string; location?: string; notes?: string; status?: "ACTIVE" | "INACTIVE" }) {
    this.owner(actor);
    if (input.status !== undefined && !["ACTIVE", "INACTIVE"].includes(input.status)) throw new BadRequestException("Invalid supplier status");
    return this.db.$transaction(async (tx) => {
      const row = await tx.supplier.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: text(input.name, "Supplier name", 160) }),
          ...(input.phone === undefined ? {} : { phone: optionalText(input.phone, 80) }),
          ...(input.location === undefined ? {} : { location: optionalText(input.location, 200) }),
          ...(input.notes === undefined ? {} : { notes: optionalText(input.notes) }),
          ...(input.status === undefined ? {} : { status: input.status })
        }
      });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "Supplier", entityId: row.id, action: "UPDATED" } });
      return { id: row.id };
    });
  }

  async supplierDetail(actor: Actor, id: string) {
    this.owner(actor);
    const row = await this.db.supplier.findUnique({ where: { id }, include: { purchases: { orderBy: { purchaseDate: "desc" } }, payments: { orderBy: { paymentDate: "desc" }, include: { financialAccount: true } } } });
    if (!row) throw new NotFoundException("Supplier not found");
    return { id: row.id, name: row.name, phone: row.phone, debt: row.purchases.filter((p) => p.status !== "REVERSED").reduce((sum, p) => sum.add(p.balanceDue), dec(0)).toFixed(4), purchases: row.purchases.map((p) => ({ id: p.id, purchaseNo: p.purchaseNo, purchaseDate: p.purchaseDate.toISOString(), totalCost: p.totalCost.toFixed(4), paidAmount: p.paidAmount.toFixed(4), balanceDue: p.balanceDue.toFixed(4), status: p.status })), payments: row.payments.map((p) => ({ id: p.id, paymentNo: p.paymentNo, paymentDate: p.paymentDate.toISOString(), amount: p.amount.toFixed(4), status: p.status, accountName: p.financialAccount.name })) };
  }

  async createSupplierPurchase(tx: Tx, actor: Actor, input: { supplierId: string; receiptId: string; fuelId: string; quantityFuusto: Prisma.Decimal; unitCost: Prisma.Decimal; totalCost: Prisma.Decimal; purchaseDate: Date }) {
    const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, status: "ACTIVE" } });
    if (!supplier) throw new BadRequestException("Select an active supplier");
    return tx.supplierPurchase.create({ data: { purchaseNo: documentNo("PUR"), supplierId: supplier.id, receiptId: input.receiptId, fuelId: input.fuelId, quantityFuusto: input.quantityFuusto, litersPerFuustoSnapshot: dec(240), unitCost: input.unitCost, totalCost: input.totalCost, balanceDue: input.totalCost, purchaseDate: input.purchaseDate, createdById: actor.id } });
  }

  async createSupplierPaymentInTransaction(tx: Tx, actor: Actor, key: string, input: { supplierId: string; financialAccountId: string; amount: Prisma.Decimal; paymentDate: Date; reference?: string | null; notes?: string | null; purchaseId?: string }) {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new NotFoundException("Supplier not found");
    const purchases = await tx.supplierPurchase.findMany({ where: { supplierId: supplier.id, status: { in: ["OPEN", "PARTIALLY_PAID"] }, ...(input.purchaseId ? { id: input.purchaseId } : {}) }, orderBy: [{ purchaseDate: "asc" }, { id: "asc" }] });
    const debt = purchases.reduce((sum, purchase) => sum.add(purchase.balanceDue), dec(0));
    if (input.amount.gt(debt)) throw new BadRequestException(`Supplier debt is $${debt.toFixed(2)}. You cannot pay more.`);
    const payment = await tx.supplierPayment.create({ data: { paymentNo: documentNo("SPAY"), supplierId: supplier.id, financialAccountId: input.financialAccountId, amount: input.amount, paymentDate: input.paymentDate, reference: input.reference, notes: input.notes, idempotencyKey: key, recordedById: actor.id } });
    let remaining = input.amount;
    for (const purchase of purchases) {
      const allocated = Prisma.Decimal.min(remaining, purchase.balanceDue);
      if (allocated.lte(0)) break;
      await tx.supplierPaymentAllocation.create({ data: { supplierPaymentId: payment.id, supplierPurchaseId: purchase.id, amount: allocated } });
      const balance = purchase.balanceDue.sub(allocated); const paid = purchase.paidAmount.add(allocated);
      await tx.supplierPurchase.update({ where: { id: purchase.id }, data: { paidAmount: paid, balanceDue: balance, status: balance.isZero() ? "PAID" : "PARTIALLY_PAID" } });
      remaining = remaining.sub(allocated);
    }
    await tx.supplierPayment.update({ where: { id: payment.id }, data: { allocatedAmount: input.amount.sub(remaining) } });
    await this.postMovement(tx, actor, { accountId: input.financialAccountId, direction: "MONEY_OUT", kind: "SUPPLIER_PAYMENT", amount: input.amount, occurredAt: input.paymentDate, sourceType: "SupplierPayment", sourceId: payment.id, referenceNo: payment.paymentNo, description: `Supplier payment: ${supplier.name}` });
    await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "SupplierPayment", entityId: payment.id, action: "POSTED" } });
    return payment;
  }

  supplierPayment(actor: Actor, key: string | undefined, supplierId: string, input: { financialAccountId?: string; amount?: string; paymentDate?: string; reference?: string; notes?: string }) {
    this.owner(actor);
    return this.execute(actor, key, "supplier-payment", { supplierId, ...input }, async (tx) => {
      const payment = await this.createSupplierPaymentInTransaction(tx, actor, key!, { supplierId, financialAccountId: text(input.financialAccountId, "Financial account"), amount: money(input.amount, "Payment"), paymentDate: dateValue(input.paymentDate, "Payment date"), reference: optionalText(input.reference, 200), notes: optionalText(input.notes) });
      return { id: payment.id };
    });
  }

  reverseSupplierPayment(actor: Actor, key: string | undefined, id: string, reasonInput: unknown) {
    this.owner(actor); const reason = text(reasonInput, "Reason", 500);
    return this.execute(actor, key, "supplier-payment-reversal", { id, reason }, async (tx) => {
      const payment = await tx.supplierPayment.findUnique({ where: { id }, include: { allocations: { include: { supplierPurchase: true } }, reversal: true } });
      if (!payment) throw new NotFoundException("Supplier payment not found");
      if (payment.status === "REVERSED") return { id, status: "REVERSED", replay: true };
      const claimed = await tx.supplierPayment.updateMany({ where: { id, status: "POSTED" }, data: { status: "REVERSED" } });
      if (claimed.count !== 1) return { id, status: "REVERSED", replay: true };
      for (const allocation of payment.allocations) {
        const paid = Prisma.Decimal.max(0, allocation.supplierPurchase.paidAmount.sub(allocation.amount));
        const balance = allocation.supplierPurchase.totalCost.sub(paid);
        await tx.supplierPurchase.update({ where: { id: allocation.supplierPurchaseId }, data: { paidAmount: paid, balanceDue: balance, status: paid.isZero() ? "OPEN" : "PARTIALLY_PAID" } });
      }
      const reversal = await tx.supplierPaymentReversal.create({ data: { reversalNo: documentNo("SPREV"), supplierPaymentId: id, idempotencyKey: key!, reason, reversedById: actor.id } });
      const original = await tx.financialAccountMovement.findFirst({ where: { sourceType: "SupplierPayment", sourceId: id, kind: "SUPPLIER_PAYMENT" } });
      await this.postMovement(tx, actor, { accountId: payment.financialAccountId, direction: "MONEY_IN", kind: "SUPPLIER_PAYMENT_REVERSAL", amount: payment.amount, occurredAt: new Date(), sourceType: "SupplierPaymentReversal", sourceId: reversal.id, referenceNo: reversal.reversalNo, description: reason, reversalOfId: original?.id });
      return { id, status: "REVERSED" };
    });
  }

  async expenses(actor: Actor) {
    this.owner(actor);
    const rows = await this.db.businessExpense.findMany({ orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }], include: { financialAccount: true } });
    return rows.map((row) => ({ id: row.id, expenseNo: row.expenseNo, description: row.description, category: row.category, amount: row.amount.toFixed(4), expenseDate: row.expenseDate.toISOString(), accountName: row.financialAccount?.name ?? "Outside / Not Tracked", outsideTracked: row.outsideTracked, reference: row.reference, status: row.status }));
  }

  createExpense(actor: Actor, key: string | undefined, input: { description?: string; category?: string; amount?: string; expenseDate?: string; financialAccountId?: string; outsideTracked?: boolean; reference?: string; notes?: string }) {
    this.owner(actor);
    return this.execute(actor, key, "expense-create", input, async (tx) => {
      if (!input.outsideTracked && !input.financialAccountId) throw new BadRequestException("Select a financial account or Outside / Not Tracked");
      const value = money(input.amount, "Expense"); const at = dateValue(input.expenseDate, "Expense date");
      const expense = await tx.businessExpense.create({ data: { expenseNo: documentNo("EXP"), description: text(input.description, "Description", 240), category: text(input.category, "Category", 120), amount: value, expenseDate: at, financialAccountId: input.outsideTracked ? null : input.financialAccountId, outsideTracked: Boolean(input.outsideTracked), reference: optionalText(input.reference, 200), notes: optionalText(input.notes), idempotencyKey: key!, createdById: actor.id } });
      if (expense.financialAccountId) await this.postMovement(tx, actor, { accountId: expense.financialAccountId, direction: "MONEY_OUT", kind: "EXPENSE", amount: value, occurredAt: at, sourceType: "BusinessExpense", sourceId: expense.id, referenceNo: expense.expenseNo, description: expense.description });
      await tx.auditEvent.create({ data: { actorId: actor.id, entityType: "BusinessExpense", entityId: expense.id, action: "POSTED" } });
      return { id: expense.id };
    });
  }

  reverseExpense(actor: Actor, key: string | undefined, id: string, reasonInput: unknown) {
    this.owner(actor); const reason = text(reasonInput, "Reason", 500);
    return this.execute(actor, key, "expense-reversal", { id, reason }, async (tx) => {
      const expense = await tx.businessExpense.findUnique({ where: { id }, include: { reversal: true } });
      if (!expense) throw new NotFoundException("Expense not found");
      if (expense.status === "REVERSED") return { id, status: "REVERSED", replay: true };
      const claimed = await tx.businessExpense.updateMany({ where: { id, status: "POSTED" }, data: { status: "REVERSED" } });
      if (claimed.count !== 1) return { id, status: "REVERSED", replay: true };
      const reversal = await tx.expenseReversal.create({ data: { reversalNo: documentNo("EXPREV"), expenseId: id, idempotencyKey: key!, reason, reversedById: actor.id } });
      if (expense.financialAccountId) {
        const original = await tx.financialAccountMovement.findFirst({ where: { sourceType: "BusinessExpense", sourceId: id, kind: "EXPENSE" } });
        await this.postMovement(tx, actor, { accountId: expense.financialAccountId, direction: "MONEY_IN", kind: "EXPENSE_REVERSAL", amount: expense.amount, occurredAt: new Date(), sourceType: "ExpenseReversal", sourceId: reversal.id, referenceNo: reversal.reversalNo, description: reason, reversalOfId: original?.id });
      }
      return { id, status: "REVERSED" };
    });
  }
}
