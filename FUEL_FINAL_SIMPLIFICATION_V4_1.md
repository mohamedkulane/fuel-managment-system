# Fuel Wholesale System — Final Simplification & Accuracy Fix (V4.1)

**Purpose:** One authoritative implementation brief for Codex. This V4.1 brief supersedes previous V2/V3 usability instructions wherever they conflict. Do not copy an entire previous prompt verbatim; reconcile against the latest confirmed business decisions. This is a **refactor of an existing working codebase**, not a fresh application. **No production deployment.**

## 0. Confirmed scope and implementation order

Business: one Somali fuel wholesaler buying Diesel/Naafto and Petrol/Basiin **in whole fuusto**; **1 fuusto = 240 L**. Customer orders are in whole fuusto. Owner can change today's selling price per fuusto independently for each fuel; confirmed orders retain their historical price. Optional **one fixed-dollar discount on the entire order**, owner-approved; not percentage or per-fuusto discount. Optional owner-only stock purchase cost; no fabricated profit if cost/valuation is unavailable. Customers can order while owing money, pay in parts and accept fewer fuusto than requested. Staff gets a manually printed **non-financial** daily delivery list; no driver account. Roles only `OWNER` and `OFFICE_EMPLOYEE`.

Before editing:
1. Read `AGENTS.md`, current requirements, decision log, V3 brief, Prisma schema, API, routes, tests and the actual local branch. Note where old docs contradict newer owner requirements; update docs consistently after confirming the changes.
2. Create a baseline list of **all existing navigable routes, actions and documents**, including links in tables, dialogs, dashboard quick actions and nested detail screens. Capture baseline tests and take a safe git checkpoint. Never reset a real database.
3. Preserve underlying billing and financial ledger integrity, event records, permissions, existing customer accounts and stored stock/invoice/payment history. Backend invoices may be retained as accounting records, but **NO user-facing invoice page or invoice creation workflow**.
4. Fix correctness issues first (payment cap/concurrency, statements), then consolidate navigation/workflows, then tidy visual UI and verify browsers/mobile.

## 1. Exactly six MAIN navigation destinations

1. **Guudmar (Dashboard)** (`/`): simple KPIs, restored useful charts, latest orders and quick actions.
2. **Macaamiisha (Customers)** (`/customers`): add/edit customer; open customer account, history, debt, **Pay**, single **Statement**.
3. **Dalabyada (Orders)** (`/orders`): **New Order**, status/history, one **Today's List** action, record actual accepted delivery without extra user-facing modules.
4. **Kaydka (Stock)** (`/stock`): two fuel balances in fuusto, **Add Stock**, **Edit Price** for Diesel/Petrol, compact history.
5. **Warbixinnada (Reports)** (`/reports`): essential reports, one output action per report, not PDF+Print+Download buttons alongside one another.
6. **Dejinta (Settings)** (`/settings`): optional staff management, minimal account information, and **one** Sign out.

**NO distinct everyday UI modules** for invoices, payments, debts, pricing, dispatches, delivery sheets, reconciliations or audit logs. Their *needed functions* must be embedded into the proper six destinations, not merely hidden from sidebar. Where existing legacy routes exist: either remove unused user-facing screens and redirect safely to the correct section, or retain only indispensable contextual/deep-linked details. Do not strand actions on hidden pages. A customer detail may be a contextual subview of Customers; it must not introduce more sidebar modules. Audit logs can remain technically available to owner in a compact advanced settings area only if essential; do not show an “Advanced administration” block by default.

## 2. Forms and actions: lean, short, discoverable

Keep **four primary form flows**: (1) Add Customer: **Name**, **Phone**, **Location**; (2) Add Stock: **Fuel**, **Fuusto** (whole number), optional **Cost**, short date only if needed; (3) New Order: **Customer**, **Fuel**, **Fuusto**, read-only **Price**, optional **Discount**, optional **Pay Now**, total/remaining preview; (4) Pay from Customer Account: **Amount**, optional payment method/ref in expandable, concise advanced section *only if truly required*. Keep price-edit and confirm-delivery as tiny contextual dialogs, not standalone form journeys.

Short visible labels: `Name`, `Phone`, `Location`, `Fuel`, `Fuusto`, `Price`, `Discount`, `Total`, `Paid`, `Debt`; action buttons `Add`, `Edit`, `Pay`, `Save`, `Cancel`, `Statement`, `Today's List`, `Edit Price`, `Sign out`. At navigation level use `Macaamiisha (Customers)` etc where helpful. No long Somali explanations, subtitles beneath each card, transaction jargon, or repeating names in multiple headings.

**One action = one button** in the relevant context. Customer account: `Edit`, `Pay`, `Statement`; do not repeat Edit in profile header/card or Print/PDF twice above and inside ledger. Clicking `Statement` opens **one clean PDF** in a view where native browser controls can print/save; don't make separate Print and Download buttons. Orders: `Today's List` opens one **print-ready, non-financial PDF** for the selected date, not a separate page with Back, Print, Download, and Create controls. No decorative explanations.

## 3. CRITICAL: Strict customer-account payment cap (frontend + backend)

### Account `Pay` button (existing invoiced debt only)

Show immediately at the top of the dialog, in a visually prominent readable card:

> **Macmiil: Ahmed**
> **Deyn hadda: $300.00**
> **Lacag la bixinayo:** [  ]
> **Deyn ka haraysa:** [live result]
> `Cancel`  `Pay`

- **Maximum receivable in this dialog is the customer's NET CURRENT PAYABLE DEBT**, considering open posted invoice balances **and any already-unapplied credit**. E.g., invoices $300 and earlier unapplied credit $50 => cap for new cash payment **$250**, not $300. If debt is $0 or net credit, disable Pay and show `Deyn ma jiro`.
- E.g., debt $300: $100 is accepted and leaves $200; $300 is accepted and leaves $0; $400 is rejected, without posting a payment.
- Client UI: `max`, `min`, validate $ cents, helper error `Deynta waa $300. Wax ka badan lama qaadi karo.` Disable duplicate submissions, refetch debt on opening and after submission. The maximum MUST be enforced in the NestJS API too, not only in React. Do not trust stale frontend state.
- **Transactional server-side cap and concurrency:** serialize a customer's collection/allocations (safe row lock or equivalent transaction isolation/retry), recalculate net payable from authoritative persisted financial state under the transaction; reject amounts exceeding payable; reject duplicate/replayed/mismatched idempotency keys; reject attempts when debt is already settled. Preserve invariant in simultaneous payments, reversals, new invoices and credit applications.
- If the existing shared payment endpoint serves both debt collection and order-linked early payments, explicitly identify/distinguish payment *context* server-side and enforce **separate caps**. Do not accidentally allow uncapped direct API payments because an `unappliedAmount` field exists.
- Existing historical overpayments: **never delete, rewrite, zero out, or auto-refund them**. If the screenshot's $500 invoice and $850 paid reflects a real previous record, net **$350 is customer credit**, not negative debt. Show it separately as `Lacag macmiilka u taalla: $350`, and show `Deyn hadda: $0` (not `-$350`). Flag for owner review/legitimate reconciliation; do not fabricate corrections or silently net away evidence.

### `Pay Now` when creating a NEW order: distinct business case

The business owner explicitly allows $0 or partial immediate payment on a new order; they do **not** want a separate “Deposit” form or label. Keep `Pay Now` in New Order (optional) but enforce `0 <= Pay Now <= this order's agreed total` and show `Order remaining = agreed total - Pay Now`. Never allow Pay Now to exceed this order’s total.

**Accounting caveat:** Before fuel is accepted and invoiced, this cash is technically an **order-linked advance / unapplied customer payment**, regardless of what the UI calls it. Preserve it safely and link it to the intended new order for later allocation on the accepted-delivery invoice. It must **not silently pay an unrelated older debt via FIFO** if the user entered `Pay Now` explicitly for the new order. If accepted quantity or discount proration later makes the net bill smaller than pre-collected cash, present the discrepancy for owner resolution as customer credit/refund; do not retroactively invent extra debt or delete payments. If existing architecture cannot distinguish this safely, stop that affected UI flow and flag the exact implementation blocker rather than posting incorrect accounts. All independent workflows can proceed.

## 4. Customer page and ledger must be understandable

Top show **three primary totals** only: `Total Sales` (actual billed accepted fuel), `Total Paid`, `Debt` (max(0, net payable)). If actual customer credit exists, show one small distinct `Lacag u taalla` row/badge (do not confuse negative credit with debt).

Simplify account tabs: `Xisaab`, `Orders`, `Payments` (or one coherent chronological list); do not expose `Invoices`, `Subledger`, `Debit`, `Credit`, `Aging`, or technical terms. Chronological statement table visible fields: `Date`, `Type` (`Iib`, `Lacag`), `Amount`, `Balance` or `Deyn/Hadhaag`. If credit balance, show readable `Lacag u taalla` instead of `-$350` as a debt. Keep distinct invoice/reversal facts internally with traceable IDs.

Replace labels such as `BAALANSIGA UGU HORREEYA XILLIGA`, `WADARTA DEYNTA XILLIGA`, `WADARTA LACAG-BIXINTA XILLIGA`, `BAALANSIGA UGU DAMBEEYA` with short `Bilow`, `Iib`, `La bixiyay`, `Hadda` only when these measures make sense, ideally avoid redundant 4 cards atop a ledger that already has account totals. Preserve opening balance for selected period and accurate chronological closing balances, including ties / posting ordering. No duplicate Print and PDF buttons.

Use short date labels `From` / `To` (or `Bilow` / `Dhammaad`) with a clearly readable date format. Never show `Muqdisho UTC+3`, `Africa/Mogadishu`, `Entry type`, `Debit (+)` or `(Credit -)` to ordinary users. Still perform business date calculations correctly in `Africa/Mogadishu` **internally**. Defaults should show a useful current period without forcing the owner to choose dates. Keep filters compact / collapsible and optional.

The statement PDF must be clean A4, brand+customer info, date range, rows and totals, correct page breaks and repeated table headers. The PDF must match selected filters and opening/closing balances, with no confusing negative-debt label. For existing credit, label clearly as customer money held, not an amount owed by customer. One `Statement` button.

## 5. Dashboard: restore and simplify charts

Restore actual dashboard charts that the user reports are missing. The repository may contain chart-related code that fails to render in the current local branch; compare real browser behavior, not presence of a `SalesChart` function.

Keep a restrained useful chart for `Sales vs Payments` (last 7 or 30 days), and if helpful one compact **Diesel vs Petrol** stock/sales comparison. Use real API data, clearly labeled dates, no giant dashboards, no unnecessary legends/marketing cards. Empty data state: show `Xog lama hayo` **inside the chart module**, not silently omit the whole section. Charts must reflow in mobile and have usable text/accessible fallback.

## 6. Whole-number fuusto, no decimal units in UI or server

The user confirms customers buy and receive **whole fuusto**, not 1.5 or 2.75 fuusto. Enforce positive integers **for stock receiving, order quantity, dispatch quantity, accepted and returned fuusto, and all relevant user-editable quantity operations** in frontend AND APIs. Input `type=number`, `step=1`, `min=1` (or 0 where returned/accepted zero is valid), inputMode numeric; backend rejects non-integers and negative quantities. Preserve canonical internal liters with `Decimal` and **1 fuusto = 240 L**. Existing historical fractional rows must not be silently rounded or changed; surface exceptional historical records transparently if they exist. USD money can still contain **two decimal places** (e.g. $12.50); this integer rule does not apply to prices/discounts/payments.

## 7. Delivery list: one truly useful, clean PDF

In Orders show a single `Today's List` button, optionally date selector near it; on click prepare/fetch the authorized day's eligible orders. Generate a clean A4 print-ready PDF (landscape if necessary) with concise header, report date and simple table:

`Customer | Phone | Location | Fuel | Fuusto`

No price, discount, debt, collection method, revenue, cost or profit in PDF **or its response/metadata**. No empty intermediary `/deliveries` page or print toolbar with four actions. For no eligible orders, show `Ma jiraan dalabyo maanta` and do not issue a misleading blank report. Ensure entries correspond to selected date and valid delivery status, no unintended duplicates. Existing warehouse→transit and actual-accepted delivery reconciliation must still happen transactionally and be accessible from Orders as one contextual `Delivered` / `Confirm Delivery` action, not a multi-page dispatch dashboard.

## 8. Design constraints & genuine mobile-first verification

Colors: `#003333` primary, `#99CC33` accent, light neutral background, white readable surfaces. **Calm compact styling**, not giant headings or an excessive number of large cards. Desktop title approx 22–24px; body labels 14–15px; fields 15–16px, min 44px touch targets (buttons/controls). Constrain input widths using `minmax(0,1fr)`, `min-width:0`; no clipping, collisions, duplicate buttons, misaligned headings, wrapping in unreadable ways. Labels fit on one line where possible.

Test **320, 360, 390, 430, 768, 1024 and 1440 px** in a real browser: sidebar drawer on mobile, sensible scrolling, forms one column on small screens, customer/order tables become readable mobile cards or selectively condensed lists, modal fully visible and scrollable with safe focus, sticky actions only if they don't obscure inputs, PDFs readable on phones and printable on paper. **No body-level horizontal scroll.** Capture screenshots and verify interactions; a passing `next build` is not responsive evidence.

Remove redundant page descriptions, helper notes, security/legal jargon, duplicated profile headers and `Xaqiijinta Amniga & Shuruudaha` settings box. Exactly **one Sign out** from Settings. Keep genuine accessibility labels/assistive text if required but don't litter the visible UI.

## 8.1. REQUIRED: Simple toast notifications for every important action

A global **toast notification system is missing** from the current frontend and must be implemented. Use **react-hot-toast** (or a single equivalent already installed when implementation starts); do not create competing toast libraries or browser `alert()` popups. The currently reviewed repository (`apps/web/package.json`, `apps/web/src/app/providers.tsx`) has no toast library or global Toaster mounted. Install the necessary dependency and mount **exactly one accessible Toaster** at application provider/root level so notifications also appear from customer/order/stock/settings modals and nested routes.

**Design:** small, elegant, accessible, non-blocking corner toasts matching dark teal `#003333`, lime `#99CC33` and readable white/light surfaces. Place them top-right on desktop, top-center or other safe inset on small screens; avoid overlap with modal controls, mobile navigation or save buttons. Default success duration about 3 seconds, errors about 5 seconds or dismissible, and never stack unlimited messages. Provide meaningful success/error icons, adequate contrast, and `aria-live` announcements. Use simple concise mixed Somali/English wording. Avoid large cards, long descriptions, debug traces or internal codes.

**Notification contract:**

| Action | Successful toast | Error toast |
| --- | --- | --- |
| Add customer | `Customer added` | `Customer not saved` |
| Edit customer | `Customer updated` | `Update failed` |
| Add stock | `Stock added` (only after successful posted stock update) | `Stock not added` |
| Edit fuel price | `Price updated` | `Price not updated` |
| Save/confirm order | `Order saved` / `Order confirmed` as applicable | `Order not saved` |
| Approve discount | `Discount approved` | `Approval failed` |
| Record payment | `Payment recorded` | `Payment failed` (e.g. `Debt is $300. You cannot pay more.`) |
| Confirm delivered fuusto | `Delivery updated` | `Delivery not updated` |
| Generate/open Today's List | Only if creation is an actual persisted action; no false 'saved' toast for mere PDF viewing | `Today's List unavailable` |
| Report/statement export | Avoid toast on ordinary opening of a PDF; show failure if export cannot open/generate | `Statement unavailable` |
| Add/edit staff account | `User added` / `User updated` | `Could not save user` |

**Technical requirements:**
1. Show loading/disabled state inside the submitting button while the mutation runs. Show **one** toast only when the confirmed API mutation finishes successfully; errors produce one clear error toast (with brief specific reason for business validation). Do not show success for local UI button click or HTTP failure.
2. Integrate with existing TanStack Query mutation handlers and invalidate/refetch relevant queries after success. No manual refresh required. Avoid duplicate notifications from mutation handler plus page effect/global interceptor.
3. Critical payment limit rejection must show `Debt is $300. You cannot pay more.` and **must not** add a financial record. If zero debt, show `No debt to pay` without submitting.
4. Use toast errors for backend responses, including offline/network issues; no raw stack traces, auth tokens, Prisma messages or user-sensitive details. Keep important inline field validation near affected fields too: toast alone is not sufficient.
5. Destructive or sensitive operations still require an appropriate confirmation dialog; a toast is only acknowledgement and not confirmation or audit evidence.
6. On a new route or modal close, avoid misleading lingering `Saving...`/success states. Rate-limit/de-duplicate bursts (especially multiple submits). `Sign out` normally redirects without a redundant toast.
7. Test keyboard/screen-reader behavior, small viewport appearance, toast during open modals, success/error for each of the four primary workflows, retry/duplicate submission and payment-cap rejection.

**Success criterion:** after an actual successful `Add`, `Save`, `Pay` or `Update`, the older business user immediately sees a short clear success toast and updated figures; after an error they see a clear readable error toast and unchanged persisted data. No action silently succeeds or fails.

## 9. Codebase-specific places to inspect

- `apps/api/src/app.controller.ts`: `POST /payments` currently allows unused money as `unappliedAmount`; enforce context-dependent cap and atomicity; inspect `GET /customers/:id/financial`, customer statements, reversal and allocation logic.
- `apps/web/src/app/customers/[id]/page.tsx`: currently repeats print/download/edit and shows confusing credit/debt labels and technical ledger; simplify as above.
- `apps/web/src/app/page.tsx`: restore working chart output in actual app, don't merely keep unused chart code.
- `apps/web/src/app/orders/new/page.tsx`: reduce fields to essential and handle `Pay Now` correctly; whole fuusto.
- `apps/web/src/app/stock/receive/page.tsx`, `apps/web/src/app/stock/page.tsx`: fuusto integer display/input; edit price in stock.
- `apps/web/src/components/app-shell.tsx`: exactly six main menu items, one signout.
- `apps/web/src/app/deliveries/**`, `apps/web/src/app/dispatches/**`, `apps/web/src/app/invoices/**`, `apps/web/src/app/payments/**`, `/pricing`, `/debts`, `/audits`: consolidate workflows; no broken direct links, hidden dead ends or unnecessary public destinations.
- `apps/web/src/app/globals.css`: component sizing / responsiveness; inspect actual DOM at every breakpoint.
- `apps/api/src/reports.exporter.ts`: PDF/Excel formatting; privacy and correct filtered data.
- `docs/09-decisions/decision-log.md`, `AGENTS.md`, user documentation: reconcile new UX and no-overpay policy, note carefully the order-linked Pay Now distinction.

## 10. Must-pass financial and usability acceptance tests

1. Debt $300, Pay $100 => post $100 and debt $200, immediately refreshed UI.
2. Debt $300, Pay $300 => zero debt. Pay disabled; no negative debt.
3. Debt $300, Pay $400 => **400/422 validation error**, zero new financial records; readable message. Direct API rejects, not only UI.
4. Debt $300 with $50 **existing unapplied credit** => maximum new cash collection $250; no double applying the credit.
5. Customer no debt => Account Pay disabled/blocked.
6. Concurrent Pay $200 and $200 against debt $300 => at most $300 total posted; ledger and allocations consistent.
7. Historical example: posted invoice $500 and previously posted payments $850 => **Debt $0**, `Lacag u taalla $350`, no silent data rewriting. Statement must faithfully show events.
8. New Order: 5 fuusto × $100 − $10 fixed order discount = $490; Pay Now $100 => order remaining $390; $0 accepted. Pay Now > $490 rejected. Must be linked to the new order, not silently allocated to old debt.
9. Changing Diesel price from $100 to $150 does not alter previously confirmed orders, discount or actual accepted quantity invoicing.
10. Stock receive 50 fuusto -> 12,000 L; 1.5 fuusto rejected. Dispatch 12, accepted 10, returned 2 -> warehouse net -10 fuusto and no invented loss.
11. Customer account has only `Edit`, `Pay`, `Statement` contextual actions; no duplicate Print/Download/Edit; one PDF viewer action.
12. Orders has one `Today's List` action; PDF has exactly expected non-financial fields and correct dates, fonts and pagination; no extra delivery UI route in primary navigation.
13. Charts appear in live Dashboard with test data; sensible empty state with no data.
14. One Sign out, six sidebar entries, no Security & Conditions box, no user-visible standalone Invoice/Payments/Dispatch/Pricing modules; all necessary everyday functionality reachable.
15. At **all seven viewport sizes**, no horizontal overflow, clipped form labels, inaccessible dialogs or invisible actions; screenshot + browser interaction evidence.
16. Regression: all original important inventory/financial/role/auth/pdf tests pass; no history deletion; owner-only cost and pricing restrictions remain.
17. Toast notifications: exactly one global Toaster; successful customer/stock/order/payment mutations show one brief success toast only after the API succeeds; failures show one brief error toast. Validate mobile overlay placement, keyboard accessibility, and no duplicate toasts or false positives. Payment over-debt rejection displays a business-readable error and never creates a payment.

## 11. Execution and report requirements

Implement in reviewable slices: (A) payment correctness + statement math, (B) consolidated navigation & contextual actions, (C) chart and copy changes, (D) mobile redesign & print PDFs, (E) comprehensive regression. Do not deploy. Run Prisma validation/migration checks, typecheck, unit, integration, backend authorization, concurrency, frontend production build, and browser E2E with screenshots. Log results as PASSED/FAILED/BLOCKED, never assume. Produce `docs/audits/final-simplification-v4-1-report.md` describing changed files, any migrations, routes removed/redirected, debt/credit behavior, payment edge cases, before/after screenshots and pending business decisions.

### CODEX EXECUTION INSTRUCTION

> Read `AGENTS.md` and `FUEL_FINAL_SIMPLIFICATION_V4_1.md` at repository root. Treat this V4.1 as the latest owner-approved simplification brief, including the mandatory global toast notifications in section 8.1; do not blindly follow older complexity requirements when they conflict with this document. First audit all routes, flows, schemas, payment allocation and stored credit behavior. Make a safe git checkpoint, then implement the changes incrementally, preserving database history and backend accounting correctness. Prioritize backend payment cap + concurrency, clear customer debt statement, a single action per job, genuine functional six-page UX, restored dashboard charts and mobile-first QA. Run actual tests and capture real browser screenshots before reporting completion. Do not deploy.
