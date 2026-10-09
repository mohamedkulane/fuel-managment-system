# Phase 03 Report — Invoicing, Credit, Debt & Payment Management

Date: 2026-10-09  
Branch/commit: main / full workspace build verified

## Scope Delivered

- **Invoice Lifecycle & Billing Invariant**:
  - Invoices generated strictly from confirmed accepted delivery quantities (`DeliveryConfirmationLine.acceptedUnits`) using frozen price (`unitPriceSnapshot`) and conversion (`litersPerUnitSnapshot`) snapshots. Unaccepted or returned fuel is never billed.
  - Exactly-once invoice creation per billable delivery event enforced at the database level via `billingSourceKey` and `deliveryConfirmationLineId` `@unique` constraints.
  - Support for partial deliveries, unbilled delivery queue (`GET /api/v1/invoices/unbilled`), invoice status tracking (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REVERSED`), and printable PDF invoices using PDFKit.
- **Customer Credit & Accounts Receivable Subledger**:
  - Traceable accounting-style customer subledger (`CustomerLedgerEntry`) tracking debits (invoices, reversals), credits (payments, invoice reversals), and calculated running balances.
  - Accounts Receivable Overview (`GET /api/v1/financial/debts`) with aging buckets (Current 0-30d, 31-60d, 61-90d, 90d+) and net position calculations.
  - Unpaid invoice balance does not automatically block customers from placing new orders unless customer account status is explicitly set to `HOLD` by an Owner.
- **Payment Collection & Allocations**:
  - Manual customer payment collection (`POST /api/v1/payments`) supporting manual payment methods (`CASH`, `BANK_TRANSFER`, `EVC_PLUS`, `EDAHAB`, `OTHER`), payment references, dates, and notes.
  - Payment allocation engine supporting explicit invoice allocation or automatic FIFO allocation across customer's oldest open invoices.
  - Unapplied payment balances tracked explicitly as unapplied customer credit (`unappliedAmount`).
  - Cross-customer allocation safety enforced: payments can only be allocated to invoices belonging to the same customer.
  - Idempotency key protection (`Idempotency-Key` header) preventing duplicate payment posting on network retries.
  - Printable server-generated payment receipts (`GET /api/v1/payments/:id/receipt-pdf`).
- **Financial Immutability & Reversals**:
  - Posted financial transactions are immutable. Corrections are executed via linked reversals (`POST /invoices/:id/reverse`, `POST /payments/:id/reverse`) restricted strictly to the `OWNER` role, creating auditable counter-ledger entries and audit log records.
- **Role Permissions & Data Privacy**:
  - Both `OWNER` and `OFFICE_EMPLOYEE` can generate invoices, list/view invoices, record payments, and view customer statements.
  - Reversals are `OWNER`-only.
  - Non-financial delivery manifest isolation preserved: delivery DTOs and PDFs contain zero financial fields (prices, debts, payments, taxes, costs, or profits).
- **Next.js App Router UI**:
  - Full frontend pages built with Midnight Operations theme: `/invoices`, `/invoices/[id]`, `/payments`, `/payments/[id]`, `/debts`, and extended `/customers/[id]` with Financial Profile & Chronological Account Statement tabs.

## Database Migrations Applied

- `packages/database/prisma/migrations/20261009100000_phase_03_invoicing_payments/migration.sql`
- Prisma models added: `Invoice`, `InvoiceLine`, `Payment`, `PaymentAllocation`, `PaymentReversal`, `CustomerLedgerEntry`.
- Enums added: `InvoiceStatus`, `PaymentStatus`, `PaymentMethod`, `LedgerEntryType`.

## API Endpoints Completed & Verified

- **Invoices**: `GET /api/v1/invoices/unbilled`, `POST /api/v1/invoices`, `GET /api/v1/invoices`, `GET /api/v1/invoices/:id`, `GET /api/v1/invoices/:id/pdf`, `POST /api/v1/invoices/:id/reverse` (Owner only).
- **Payments**: `POST /api/v1/payments`, `GET /api/v1/payments`, `GET /api/v1/payments/:id`, `GET /api/v1/payments/:id/receipt-pdf`, `POST /api/v1/payments/:id/reverse` (Owner only).
- **Financial Debts & Statements**: `GET /api/v1/financial/debts`, `GET /api/v1/customers/:id/financial`, `GET /api/v1/customers/:id/statement`, `GET /api/v1/customers/:id/statement/pdf`.

## Verification Executed

- **TypeScript Typecheck**: Passed cleanly with **0 errors** across all 4 workspace packages (`pnpm typecheck`).
- **Unit & Invariants**: Passed cleanly (6 tests passed, `pnpm test:unit`).
- **Database Integration Suite**: **30 database integration tests passed 100%** against local PostgreSQL (`pnpm test:integration`), covering all 20 required Phase 3 scenarios:
  1. Accepted delivery invoicing (18 accepted @ $120 = $2,160).
  2. Historical price snapshot preservation.
  3. Duplicate invoice prevention (`billingSourceKey` unique constraint).
  4. Concurrent invoice creation / idempotency.
  5. Partial invoice payment ($1,000 invoice, $300 payment -> $700 balance).
  6. Multiple installment payments ($300 + $200 = $500 paid).
  7. Multiple unpaid invoices per customer.
  8. New orders permitted despite debt.
  9. Multi-invoice payment allocation.
  10. Payment over-allocation rejection.
  11. Duplicate payment prevention via `Idempotency-Key`.
  12. Customer subledger running balance correctness.
  13. Subledger entry transaction history.
  14. Payment reversal & invoice balance restoration.
  15. Financial record immutability.
  16. Invalid input rejection (negative amounts).
  17. Employee role authorization enforcement (Office employee cannot reverse).
  18. Delivery manifest financial data privacy.
  19. Database transaction rollback safety.
  20. End-to-end order -> dispatch -> reconcile -> invoice -> payment workflow.
- **Next.js Production Build**: Passed with **0 errors** (`pnpm --filter @fuel/web build`), compiling 22 static/dynamic routes.

## Phase 3 Status

**COMPLETE & VERIFIED**. Phase 3 backend, database models, shared schemas, subledger, frontend screens, PDF export, and database integration tests are fully satisfied. Phase 4 has not been started.
