# Somali Language Localization — Phase 10 Final Report

## Executive Summary
The entire user-facing application for the **Fuel Wholesale Management System** has been localized into clear, natural, professional Somali. Somali is set as the default application language across all navigation components, pages, forms, tables, badges, dialogs, error messages, and report exports.

All internal code identifiers, database schemas, Prisma enums, REST API endpoints, and URL paths remain strictly unchanged, maintaining 100% backward compatibility and architectural integrity.

---

## Scope & Coverage Breakdown

### 1. Central i18n Architecture
- **Location**: `apps/web/src/lib/i18n.ts` & `apps/web/src/lib/format.ts`
- **Features**:
  - Central translation dictionary (`t`) with typed keys.
  - Domain badge formatters: `formatStatus()`, `formatRole()`, `formatFuel()`.
  - Date & time formatting set to East Africa Time (`Africa/Mogadishu`).

### 2. User Interface Components & Layout
- **App Shell (`app-shell.tsx`)**:
  - Localized branding subtext ("Hoolka Jumladlaha Shidaalka"), sidebar navigation groups, navigation links, user profile badge, accessibility skip links, and breadcrumbs.
- **Shared UI Components (`ui.tsx`, `finance-metrics.tsx`, `report-preview.tsx`)**:
  - Localized badges, loading states, error states, submit buttons, modals, pagination controls, metric cards, and report preview tables.

### 3. Application Routes & Pages Localized
1. **Authentication (`/login`)**:
   - Welcome headers, email/password labels, temporary password guidance, submit button, and error callouts.
2. **Dashboard / Guudmar (`/`)**:
   - Executive metrics, stock cards, revenue/payment charts, recent orders table, and urgent credit alerts.
3. **Customers / Macaamiisha (`/customers`, `/customers/[id]`)**:
   - Customer directory, search/filter inputs, customer creation modal, customer profile cards, status badges ("Shaqaynaya", "Kala Trsiinta", "Aan Shaqaynayn"), and financial tabs (Overview, Orders, Invoices, Payments, Ledger).
4. **Receivables & Debts / Deynta Harsan (`/debts`)**:
   - Debt aging metrics (Hadda, 31-60, 61-90, 90+ maalmood), account status holds, and receivables table.
5. **Sales Orders / Dalabyada (`/orders`, `/orders/new`, `/orders/[id]`)**:
   - Order list, draft status tags, order creation form (Fuusto quantity entry, agreed unit prices, fixed order discount request), draft price change review banners, order confirmation modals, and timeline events.
6. **Fuel Inventory / Kaydka Shidaalka (`/stock`, `/stock/receive`)**:
   - Warehouse vs In-Transit stock balances, owner stock adjustment modal, fuel stock receiving form (optional purchase price/cost calculation), and inventory movement ledger.
7. **Fuel Pricing / Qiimaha Shidaalka (`/pricing`)**:
   - Active selling price cards per Fuusto, Fuusto capacity history table, price change modals, and version history registers.
8. **Deliveries / Gaarsiinta Shidaalka (`/deliveries`, `/deliveries/[id]`)**:
   - Delivery list preparation, printable delivery DTO sheet (devoid of price/debt information), and dispatch tracking.
9. **Dispatches & Reconciliation / Shidaal Dirid (`/dispatches`, `/dispatches/[id]`, `/dispatches/[id]/reconcile`)**:
   - Physical dispatch details, delivery reconciliation form (dispatched, accepted fuusto/liters, and physical returned fuel disposition).
10. **Invoices / Biilasha (`/invoices`, `/invoices/[id]`)**:
    - Commercial invoice register, invoice creation from accepted delivery events, fixed discount pro-rating display, payment allocations history, and owner reversal modal.
11. **Payments / Lacag-bixinnada (`/payments`, `/payments/[id]`)**:
    - Payment receipt collection form (Cash, EVC Plus, eDahab, Bank Transfer), optional invoice allocation breakdown, credit position cards, and receipt detail view.
12. **Reports Hub / Warbixinnada (`/reports`)**:
    - Report hub cards (10 report types), date range controls (Mogadishu UTC+3), customer selection dropdowns, PDF/Excel export triggers, and inline data preview.
13. **Audit Logs / Diiwaanka Hawlaha (`/audits`)**:
    - Owner security log table, entity/action filters, redacted payload inspectors, and export options.
14. **Settings & Access / Dejinta (`/settings`)**:
    - Account identity, operational safeguards notice, team member metrics, role badges ("Milkiile", "Shaqaale Xafiis"), and user creation modal.

---

## Domain Invariants Preserved
1. **Confirmed Fuusto Volume**: `1 FUUSTO = 240 LITERS` statically preserved. Display labels explicitly state Fuusto units.
2. **Confidential Delivery Manifests**: Delivery sheets and PDF manifests strictly exclude prices, debt, purchase costs, or profit data.
3. **Decimal Arithmetic & Idempotency**: All monetary amounts use string-formatted decimal arithmetic; backend contracts and idempotency headers remain intact.
4. **Role Safety**: OWNER-only controls (pricing edits, stock receiving costs, audit logs, invoice/payment reversals) are enforced both in UI and API endpoints.

---

## Verification & Build Status
- `pnpm typecheck`: Clean compilation across `@fuel/web`, `@fuel/api`, `@fuel/database`, and `@fuel/shared`.
- All integration and unit tests pass cleanly.
