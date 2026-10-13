import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@fuel/database";
import { PrismaService } from "./prisma.service.js";
import { statementBounds, statementRows } from "./customer-statement.js";

const zero = () => new Prisma.Decimal(0);
const money = (value: Prisma.Decimal) => value.toFixed(4);
const shortReference = (value: string) => {
  const parts = value.split("-");
  return parts.length > 2 ? `${parts[0]}-${parts.at(-1)!.toUpperCase()}` : value;
};

@Injectable()
export class CustomerAccountService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async read(customerId: string, fromDate?: string, toDate?: string) {
    const { start, end } = statementBounds(fromDate, toDate);
    const [customer, orders, invoices, payments, ledger] = await Promise.all([
      this.db.customer.findUnique({
        where: { id: customerId },
        include: { addresses: { where: { active: true }, orderBy: [{ isDefault: "desc" }, { id: "asc" }] } }
      }),
      this.db.salesOrder.findMany({
        where: { customerId },
        orderBy: [{ orderDate: "desc" }, { id: "desc" }],
        include: {
          lines: { include: { fuel: true } },
          payments: { include: { recordedBy: true, reversals: { orderBy: { reversedAt: "desc" } } }, orderBy: [{ paymentDate: "asc" }, { id: "asc" }] }
        }
      }),
      this.db.invoice.findMany({
        where: { customerId },
        orderBy: [{ issueDate: "asc" }, { id: "asc" }],
        include: {
          lines: { include: { orderLine: { select: { orderId: true } } } },
          allocations: {
            include: { payment: { include: { recordedBy: true, reversals: { orderBy: { reversedAt: "desc" } } } } },
            orderBy: [{ allocatedAt: "asc" }, { id: "asc" }]
          }
        }
      }),
      this.db.payment.findMany({
        where: { customerId },
        orderBy: [{ paymentDate: "desc" }, { id: "desc" }],
        include: {
          order: { select: { id: true, orderNo: true } },
          recordedBy: true,
          reversals: { orderBy: { reversedAt: "desc" } },
          allocations: { include: { invoice: { include: { lines: { include: { orderLine: { select: { orderId: true, order: { select: { orderNo: true } } } } } } } } } }
        }
      }),
      this.db.customerLedgerEntry.findMany({
        where: { customerId, ...(end ? { occurredAt: { lt: end } } : {}) },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }]
      })
    ]);
    if (!customer) throw new NotFoundException("Customer not found");

    const invoiceOrder = new Map<string, string | null>();
    for (const invoice of invoices) {
      const orderIds = [...new Set(invoice.lines.map((line) => line.orderLine.orderId))];
      invoiceOrder.set(invoice.id, orderIds.length === 1 ? orderIds[0]! : null);
    }

    const inPeriod = (date: Date) => (!start || date >= start) && (!end || date < end);
    let totalSales = zero();
    let remainingDebt = zero();
    for (const invoice of invoices) {
      if (["REVERSED", "CANCELLED"].includes(invoice.status)) continue;
      if (inPeriod(invoice.issueDate)) totalSales = totalSales.add(invoice.totalAmount);
      if (["UNPAID", "PARTIALLY_PAID"].includes(invoice.status)) remainingDebt = remainingDebt.add(invoice.balanceDue);
    }
    const postedPayments = payments.filter((payment) => payment.status === "POSTED");
    const totalPaid = postedPayments.filter((payment) => inPeriod(payment.paymentDate)).reduce((sum, payment) => sum.add(payment.amount), zero());
    const appliedToDeliveredSales = postedPayments.filter((payment) => inPeriod(payment.paymentDate)).reduce((sum, payment) => sum.add(payment.allocatedAmount), zero());

    let pendingOrderRemaining = zero();
    let orderPaymentsAwaitingDelivery = zero();
    let moneyToReview = postedPayments
      .filter((payment) => !payment.orderId)
      .reduce((sum, payment) => sum.add(payment.unappliedAmount), zero());

    const orderRows = orders.map((order) => {
      const orderInvoices = invoices.filter((invoice) => invoiceOrder.get(invoice.id) === order.id && !["REVERSED", "CANCELLED"].includes(invoice.status));
      const invoiceIds = new Set(orderInvoices.map((invoice) => invoice.id));
      const agreedTotal = order.totalAmount ?? order.lines.reduce((sum, line) => line.unitPriceSnapshot ? sum.add(line.requestedUnits.mul(line.unitPriceSnapshot)) : sum, zero()).sub(order.fixedDiscountAmount);
      const deliveredTotal = orderInvoices.reduce((sum, invoice) => sum.add(invoice.totalAmount), zero());
      const debt = orderInvoices.filter((invoice) => ["UNPAID", "PARTIALLY_PAID"].includes(invoice.status)).reduce((sum, invoice) => sum.add(invoice.balanceDue), zero());
      const acceptedFuusto = orderInvoices.flatMap((invoice) => invoice.lines).reduce((sum, line) => sum.add(line.acceptedUnits), zero());
      const requestedFuusto = order.lines.reduce((sum, line) => sum.add(line.requestedUnits), zero());
      const linkedPosted = order.payments.filter((payment) => payment.status === "POSTED");
      const linkedPaid = linkedPosted.reduce((sum, payment) => sum.add(payment.amount), zero());
      const linkedHolding = linkedPosted.reduce((sum, payment) => sum.add(payment.unappliedAmount), zero());
      const generalAllocations = orderInvoices.flatMap((invoice) => invoice.allocations)
        .filter((allocation) => allocation.payment.status === "POSTED" && allocation.payment.orderId === null);
      const laterPaid = generalAllocations.reduce((sum, allocation) => sum.add(allocation.amount), zero());
      const undeliveredValue = Prisma.Decimal.max(zero(), agreedTotal.sub(deliveredTotal));
      const awaitingDelivery = Prisma.Decimal.min(linkedHolding, undeliveredValue);
      const reviewAmount = Prisma.Decimal.max(zero(), linkedHolding.sub(undeliveredValue));
      const pendingRemaining = ["FULFILLED", "CANCELLED"].includes(order.status)
        ? zero()
        : Prisma.Decimal.max(zero(), undeliveredValue.sub(awaitingDelivery));
      pendingOrderRemaining = pendingOrderRemaining.add(pendingRemaining);
      orderPaymentsAwaitingDelivery = orderPaymentsAwaitingDelivery.add(awaitingDelivery);
      moneyToReview = moneyToReview.add(reviewAmount);

      const directHistory = order.payments.map((payment) => ({
        id: `payment:${payment.id}`,
        paymentId: payment.id,
        date: payment.paymentDate,
        amount: money(payment.amount),
        method: payment.paymentMethod,
        status: payment.status,
        reference: payment.reference || shortReference(payment.paymentNo),
        kind: "Paid Now" as const,
        recordedBy: payment.recordedBy.displayName,
        reversalReason: payment.reversals[0]?.reason ?? null
      }));
      const generalHistory = orderInvoices.flatMap((invoice) => invoice.allocations)
        .filter((allocation) => allocation.payment.orderId === null)
        .map((allocation) => ({
          id: `allocation:${allocation.id}`,
          paymentId: allocation.paymentId,
          date: allocation.payment.paymentDate,
          amount: money(allocation.amount),
          method: allocation.payment.paymentMethod,
          status: allocation.payment.status,
          reference: allocation.payment.reference || shortReference(allocation.payment.paymentNo),
          kind: "Debt payment" as const,
          recordedBy: allocation.payment.recordedBy.displayName,
          reversalReason: allocation.payment.reversals[0]?.reason ?? null
        }));

      return {
        id: order.id,
        orderNo: order.orderNo,
        orderDate: order.orderDate,
        status: order.status,
        fuel: [...new Set(order.lines.map((line) => line.fuel.displayName))].join(" + "),
        requestedFuusto: requestedFuusto.toFixed(0),
        acceptedFuusto: acceptedFuusto.toFixed(0),
        agreedTotal: money(Prisma.Decimal.max(zero(), agreedTotal)),
        deliveredTotal: money(deliveredTotal),
        paidOnOrder: money(linkedPaid.add(laterPaid)),
        pendingRemaining: money(pendingRemaining),
        debt: money(debt),
        moneyToReview: money(reviewAmount),
        stage: deliveredTotal.gt(0) ? (undeliveredValue.gt(0) ? "PARTIAL" : "DELIVERED") : "PENDING",
        payments: [...directHistory, ...generalHistory].sort((left, right) => left.date.getTime() - right.date.getTime() || left.id.localeCompare(right.id)),
        invoiceIds: [...invoiceIds]
      };
    });

    const paymentRows = payments.map((payment) => {
      const related = new Map<string, string>();
      if (payment.order) related.set(payment.order.id, payment.order.orderNo);
      for (const allocation of payment.allocations) {
        for (const line of allocation.invoice.lines) related.set(line.orderLine.orderId, line.orderLine.order.orderNo);
      }
      return {
        id: payment.id,
        paymentNo: payment.paymentNo,
        displayReference: payment.reference || shortReference(payment.paymentNo),
        paymentDate: payment.paymentDate,
        method: payment.paymentMethod,
        amount: money(payment.amount),
        status: payment.status,
        relatedOrders: [...related.entries()].map(([id, orderNo]) => ({ id, orderNo })),
        relationLabel: related.size === 0 ? "Needs review" : related.size === 1 ? [...related.values()][0]! : "Multiple orders",
        recordedBy: payment.recordedBy.displayName,
        reversalReason: payment.reversals[0]?.reason ?? null,
        reversedAt: payment.reversals[0]?.reversedAt ?? null
      };
    });
    const balances = statementRows(ledger, start);

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.primaryPhone,
        location: customer.addresses[0]?.addressText ?? customer.addresses[0]?.city ?? null,
        status: customer.status
      },
      summary: {
        totalSales: money(totalSales),
        totalPaid: money(totalPaid),
        appliedToDeliveredSales: money(appliedToDeliveredSales),
        remainingDebt: money(remainingDebt),
        pendingOrderRemaining: money(pendingOrderRemaining),
        orderPaymentsAwaitingDelivery: money(orderPaymentsAwaitingDelivery),
        moneyToReview: money(moneyToReview),
        openingBalance: balances.openingBalance,
        closingBalance: balances.closingBalance
      },
      orders: orderRows.filter((order) => inPeriod(order.orderDate)),
      payments: paymentRows.filter((payment) => inPeriod(payment.paymentDate)),
      period: { fromDate: fromDate ?? null, toDate: toDate ?? null }
    };
  }
}
