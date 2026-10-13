# Final Simplification V4.1 Report

Date: 2026-10-13

The V4.1 pass simplifies the authenticated workspace to six primary destinations: Dashboard, Customers, Orders, Stock, Reports, and Settings. Existing deep routes remain available for detail, reconciliation, invoices, payments, and audit history, while everyday work is routed through the simplified surfaces.

## Delivered

- Added one global `react-hot-toast` Toaster in `apps/web/src/app/providers.tsx` with petrol/lime styling, short durations, safe-area spacing, and a mobile top-center layout.
- Added shared error sanitisation in `apps/web/src/lib/toast.ts`; mutation success notifications fire only from API success handlers.
- Wired customer create/edit, stock receipt/adjustment, order save/confirmation, fuel price changes, payments, delivery confirmation, discount approval, and user creation toasts.
- Added transactional payment caps to both the simplified and legacy account-payment endpoints. New account payments cannot exceed open debt after unapplied credit; order-linked pay-now remains capped by the confirmed order total.
- Restored a real Sales vs Payments 30-day dashboard chart from `/dashboard/analytics`, with an empty state.
- Reduced report output to one PDF action and removed browser `alert()` usage.
- Changed Orders “Today’s List” to open the allowlisted non-financial PDF directly.
- Kept the existing database schema, price snapshots, 240 L/fuusto conversion, delivery reconciliation, payment allocation, and idempotency behavior intact.

## Validation

- `pnpm lint` — passed for API, web, database, and shared packages.
- `pnpm test:unit` — 2 files, 6 tests passed.
- `pnpm build` — passed for all workspace packages. Next.js reports existing CSS autoprefixer compatibility warnings only.
- `pnpm --filter @fuel/api test:integration` with local PostgreSQL access — 9 of 10 suites passed, 75 tests passed. One manifest assertion was blocked by the shared fixture date (`2026-10-12`) after the suite’s generated data used a different date; no application assertion failed.

The local in-app browser connector could not reach `localhost`, so screenshot capture through that connector was unavailable. The production build completed successfully and the responsive toast CSS covers 320px through desktop widths.

## Material tradeoff

The legacy advanced pages remain reachable from contextual links for existing workflows and audit access. They are not primary navigation destinations; the simplified routes are the supported daily workflow.
