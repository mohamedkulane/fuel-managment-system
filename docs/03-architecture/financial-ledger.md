# Invoice, Payment and Credit Ledger

## Posted documents
- `Invoice` + `InvoiceLine`: created from a confirmed actual accepted delivery event with immutable price/quantity snapshot, invoice number, customer, currency, service date, postedAt and dueDate. A delivery event is billable **once** via unique source key.
- `Payment`: a real collection, not merely a promise; amount, method, reference, local business date, collector, source, postedAt, reversal link.
- `PaymentAllocation`: join a payment to specific invoices; support split over several invoices; FIFO (oldest due date, postedAt, ID) default and explicitly chosen manual allocation alternative.
- `CreditNote` + `CreditApplication`: owner-approved adjustment to posted invoices (returns/refunds/error), linked to original invoice and reason.
- `CustomerUnappliedCredit`: derived from posted payment amount not allocated, or stored as transactionally updated projection; treated as customer credit/liability, not debt negative.

## Balances
```
GrossPostedCharges(customer) = SUM(posted invoice net totals)
ValidInvoiceCredits(customer) = SUM(applied posted credit notes)
ValidAllocatedPayments(customer) = SUM(non-reversed payment allocations)
OutstandingAR(customer) = MAX(0, GrossPostedCharges - ValidInvoiceCredits - ValidAllocatedPayments)
UnappliedCustomerFunds(customer) = SUM(non-reversed payments) - ValidAllocatedPayments - other explicit applications/refunds
NetCustomerPosition (labeled) = OutstandingAR - UnappliedCustomerFunds
```
Use exact SQL NUMERIC. Actual individual invoice outstanding must not go below zero. If invoice and unapplied funds coexist, show both distinctly; do not implicitly apply a payment until an auditable allocation transaction occurs.

## Example
Invoices $500 + $360 after 2 deliveries with historical prices. Receipt $200 allocated to first: outstanding $660. Later receipt $800: allocate $300 to finish first, $360 to second, **$140 unapplied**. Outstanding AR $0, unapplied customer funds $140; do not show a nonsensical $-140 debt balance.

## Reversals
Posted invoice is not updated in place; use linked owner-approved credit note. Posted receipt is not deleted; use linked reversal and compensating allocations. A payment reversal is rejected if dependent application/credit notes require controlled unwind; all changes audit original ID, actor, reason and time.

## Posting safeguards
- Atomic multi-row DB transaction with lock on customer financial account and eligible invoice rows; verify no over-allocation.
- Unique reference number per document type and idempotency key per operation.
- Reject zero/negative receipts unless using explicit reversal path.
- All financial metadata protected from unauthenticated users; supplier cost/gross margin OWNER-only.
- Payment methods are manual records (e.g. cash, bank, EVC Plus, eDahab). **No payment gateway integration**.

## Profit and valuation
Gross margin is not simply payments received minus tanker cost. Use delivered revenue recognized on posted invoices versus methodologically consistent cost of goods sold and explicitly configured expenses. Before input coverage and valuation are confirmed, the dashboard must **not** present unverified profit as authoritative.
