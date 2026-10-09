# Phase 03 — Invoices, Deyn (Credit), Partial Payments

**Goal:** Correct posted receivables based only on accepted delivery; multiple installment receipts per customer and across invoices; auditable statements and reversals.

## Deliverables
- Post invoice automatically via explicit back-office action (or configured audited workflow) from **unbilled accepted delivery event**, with exact historical price/conversion snapshot. Protect `(deliveryConfirmationLineId)` uniqueness.
- Support multiple partial deliveries -> separate billable accepted events, never invoice ordered-but-not-accepted fuel.
- Invoice lines and totals as decimals with documented line-level rounding; per-customer due date from owner-configured policy, default only after confirmation.
- Payment entry by OWNER/OFFICE: amount, date, selected configured manual payment method (cash/bank/EVC Plus/eDahab), collector, reference/notes, auto receipt number, print receipt.
- Allocate one receipt to one/many invoices, multiple receipts to one invoice; FIFO default, manual splits allowed; overpayment shown as **unapplied customer credit**.
- Customer profile financial tabs and chronological statement, both `Outstanding receivable` and `Unapplied credit` (plus clear labeled net position). Aging buckets.
- Owner-only payment reversal and linked credit note: never destroy or rewrite original posted history. Maintain audit.
- Office financial access limited to collections/invoices, no supplier cost/profit.

## API/model work
Create `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation`, `PaymentReversal`, `CreditNote`, `CreditApplication`, `PaymentMethod`; transactions/locks/idempotency for posting. Add invoices/payments/customer-statement endpoints in API contracts. DB constraints and tests for no cross-customer allocation, duplicate posting or overpay.

## Tests — must run
1. Day 1 accepted 5 fuusto at $100 => invoice $500; day 2 accepted 3 fuusto at $120 => $360; payment $200 => debt exactly **$660**.
2. Customer with existing unpaid invoices is not blocked from another order absent owner hold.
3. 20 ordered, only 18 accepted @ $120 => one billable $2,160 event, not $2,400. If customer pays $600, debt **$1,560**.
4. Five separate partial payments reconcile correctly across three invoices; FIFO matches expected order.
5. Overpayment: $500+$360 invoices and $1,000 total paid/allocated => $0 outstanding and $140 unapplied funds, not negative outstanding.
6. Repeated payment/invoice POST with same idempotency key never duplicates receipts; race cannot over-allocate.
7. Office cannot reverse receipt/credit invoice; Owner reversal leaves historic records with reason.
8. Payment entered for wrong customer cannot be allocated to another customer's invoice.
9. Customer statement running totals equal underlying posted journals and export totals.

## Exit artifacts
Invoice/payment UI and API, receipts/statement, ledger reconciliation tests, CI, permissions checks, docs decision changes, `phase-03-report.md`, owner approval before Phase 4.
