# GEMINI TASK — Apply FuelDesk V4 Petrol & Lime Design Across Every Existing Page

You are redesigning the **existing, implemented Fuel Wholesale Management System**, not building a new project from scratch.

## Authority, scope and priorities

1. Read root `AGENTS.md`, all applicable `docs/`, current phase reports, decision log, existing Next.js routes, shared components, APIs, authentication, permissions and tests.
2. Review the attached reference package: `fueldesk-petrol-lime-v4/index.html`, `styles.css`, `app.js`, `docs/UI_DESIGN_SYSTEM_V4.md`, and screenshot previews.
3. **Replace the old Midnight Operations navy/blue/amber theme and the oversized split-screen login design everywhere.** Adopt mandatory brand colors `#003333` and `#99CC33`, neutral background `#F6F8F5`, white surfaces and carefully controlled supporting text/border colors. No leftover blue-primary or amber-brand buttons.
4. Treat the prototype as a **visual and layout reference only**. Do **not** copy its mock state/data, fake login, demo handlers, placeholder actions, sample API behavior or fake totals into the real application.
5. Preserve ALL backend business rules, database, routes, real data, services, session security, authorization and production behavior. The work is **frontend UI/UX refactor with targeted bug fixes**, not a domain rewrite.
6. Audit every existing frontend route and component before editing. Create a route-by-route checklist; update all existing screens, including nested detail and creation routes. Do not skip a page just because it was not directly shown in a preview.

## Primary visual language

- Petrol `#003333`: sidebar, primary actions, headings, selected tabs, dark KPI cards.
- Lime `#99CC33`: active navigation, high-priority CTAs, selected chart bars, limited positive emphasis. Petrol text on lime backgrounds.
- Warm neutral / soft gray-green canvas `#F6F8F5`; white content cards; soft border `#E0E9E4`.
- Tight, intentional spacing; compact dashboards; elegant business density; modern typography; small buttons, recognizable Lucide icons; no illustration or decorative image assets, no oversize empty white space, no split marketing hero on login, no generic gradient-heavy admin template.
- Consistent cards, status badges, table filters, modals and toast styling. Clear numerical hierarchy and money alignment.
- Full responsive support. Screens must be functional on mobile, with accessible navigation and scroll-safe data tables.

## REQUIRED pages/modules (adapt to actual repository routes)

**AUTH:** Login and logged-out states (minimal centered login design). Correct any login API routing mismatch (see below).

**DASHBOARD:** Real executive KPIs, distinct invoices vs payments vs outstanding debt, fuel per type, in-transit stock, sales/collections bars, real operational activity.

**CUSTOMERS:** Customer directory, registration/edit, customer profile, account overview, orders/deliveries, invoices/debts, payments, chronological financial ledger with opening/running/closing balance, statement print/PDF. All values from authoritative backend.

**ORDERS:** Lists and search/filter, create/edit draft, confirmation, detail, status timeline, unit/price snapshots, actions tied to legitimate lifecycle.

**INVENTORY/BOOYAD:** Stock overview, stock movement table, tanker receipt list/detail/creation/posting, adjustment workflow; warehouse vs transit clearly separated. Respect owner-only purchase costs and adjustments.

**PRICING:** prominent editable Diesel/Naafto and Petrol/Basiin **selling rate** cards, owner-only Change Rate action, price history/effective dates, fuusto conversion configuration and history. New prices do not alter confirmed historic sales.

**DELIVERY/DISPATCH:** Delivery sheet list, create/selection, operational manifest print/PDF (STRICTLY no financial fields), dispatch overview/details/posting, reconciliation UI (ordered / dispatched / accepted / returned / remaining in transit), status and notes.

**FINANCE:** Invoice list/detail/creation/PDF, payment collection/allocation/history/detail/receipt, customer debt overview, unapplied credits, partial payments/reversals and privacy roles.

**REPORTS:** The existing ten real report categories with filters, good tables and professional PDF/Excel actions. Preserve accurate report engines and owner-restricted profitability, without inventing costing policy.

**ADMIN:** User management (OWNER and OFFICE_EMPLOYEE only), settings, audit trail, errors/empty/loading states.

## Critical screenshot-visible login defect

The old login UI displays **`Cannot POST /auth/login`**. Your task includes identifying and fixing the REAL cause. Previously documented NestJS auth endpoint is `POST /api/v1/auth/login`, while the UI error shows `/auth/login`. Inspect actual backend/controller route registrations, frontend fetch clients, proxy/rewrite and environment variables. Use the correct route and server origin. Verify cookies, `credentials: 'include'` where needed, same-site/CORS/CSRF rules and real session creation. Do NOT bypass auth or simply hide the error message. Provide actual integration/browser evidence of successful login and logout.

## Nonnegotiable business logic preservation

- Only roles `OWNER`, `OFFICE_EMPLOYEE`. No driver account or delivery portal.
- Booyad is a tanker truck, fuel receipts are measured in actual liters.
- Fuusto is a smaller sale container: no hardcoded production 20 L (sample only).
- Canonical inventory uses Decimal liters.
- Prices and fuusto conversions must retain immutable order snapshots.
- Customer is billed only for accepted delivery quantity.
- Payments in installments, outstanding debts and repeated customer orders continue to function.
- No financial data in delivery manifest JSON, HTML or PDF metadata.
- Pending owner/customer operational decisions remain pending; do not invent new rules.
- Never destructively overwrite posted transactions, database history or migrations.

## Implementation procedure

1. **Inventory:** Enumerate ALL current routes and shared UI files. Map the reference screen types to each existing route. Capture current screenshots where browser test tools are available.
2. **Foundation:** Define theme CSS variables/tailwind tokens from `UI_DESIGN_SYSTEM_V4.md`; replace old global design tokens, sidebar and header. Use proper contrast and accessible focus states.
3. **Components:** Refactor/design consistent app shell, page headers, KPI cards, tables, search/filter controls, form fields, action buttons, tabs, modals, toasts, report cards, PDF print views and loading states.
4. **Page-by-page:** Apply new layouts on every route, matching information architecture in the reference. Preserve existing routes and typed DTOs. New UI components must call existing real backend endpoints.
5. **Customer account priority:** Expose full customer orders, invoices, partial payments, debts, ledger and print/download PDF from one well-organized customer profile. Do not double count unbilled orders as debt.
6. **Pricing priority:** Ensure an OWNER can quickly change the current Diesel or Petrol rate in one purposeful modal. Show current price, date and history. Test that new orders use new rates while old snapshots stay frozen.
7. **Auth bug:** Fix the `Cannot POST /auth/login` routing/integration defect with actual end-to-end verification.
8. **Responsive and print:** Check 1440px, 1280px, 768px, 390px, focus/keyboard states, dialogs, long tables and multi-page PDF/print layouts. The manifest must stay non-financial.
9. **State synchronization:** Use TanStack Query invalidations/update patterns after operations so changes appear without manual page refresh. No stale KPI or interested/status view.
10. **Tests & evidence:** Run typecheck, lint, unit/integration tests, web production build, API smoke and browser E2E (if available). Verify interactions after visual changes. Report blocked checks honestly.

## Deliverables

- All existing real application pages updated to this theme, not only one dashboard or login mockup.
- Reusable theme/component approach and no redundant route clones.
- `docs/ui/fueldesk-v4-implementation.md` recording before/after route inventory, changed components, theme tokens, unresolved UI gaps, screenshot references, auth login fix and test commands/results.
- Screenshot previews for login, dashboard, customer profile/ledger, orders, inventory, price book, delivery sheet, invoices, payments, debts and reports at desktop + key mobile states.
- A concise final route-by-route checklist marking DONE / PARTIAL / BLOCKED and a list of genuinely remaining issues.

Do not mark this task complete until every existing page has been reviewed, redesigned consistently and verified as functional. Do not change the business's operational decisions on behalf of its owner.
