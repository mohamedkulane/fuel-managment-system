# FuelDesk V4 — Petrol & Lime UI Design Standard

**Status:** Approved visual proposal / implementation reference. Not a replacement for business specifications in `AGENTS.md` or `docs/`.

## 1. Design direction

**Name:** Petrol & Lime / Quiet Operations.

**Personality:** Trustworthy, precise, modern, quiet, human-designed, data-first. A business application that office staff can use all day without visual fatigue. No sales-landing-page hero panels inside the product.

**User-requested mandatory colors:** `#003333` (deep petrol / primary dark) and `#99CC33` (lime green / emphasis). The user's `@99CC33` should be interpreted as valid CSS hex `#99CC33`.

| Design token | Hex | Usage |
| --- | --- | --- |
| `--petrol` | `#003333` | sidebar, headings, primary buttons, table actions, selected tabs, dark KPI cards |
| `--lime` | `#99CC33` | main CTA, active sidebar item, focused accents, selected data bars |
| `--lime-pale` | `#F0F8E0` | pale success info backgrounds |
| `--petrol-soft` | `#124847` | muted teal surfaces, dark hover |
| `--canvas` | `#F6F8F5` | quiet dashboard background |
| `--white` | `#FFFFFF` | panels, forms, modals |
| `--ink` | `#152C29` | content headings and primary text |
| `--body` | `#465D58` | secondary text |
| `--muted` | `#7A8B85` | helper text, timestamps |
| `--line` | `#E0E9E4` | subtle separators |
| `--red` | `#B74A41` | errors/negative actions, not general branding |
| `--amber` | `#B37E24` | warnings/pending states |

**Contrast:** On bright lime buttons, use deep petrol (`#003333`) text, not white text. On deep petrol, use white or lime. Ensure WCAG AA body text contrast, visible keyboard focus, and never rely on color alone for statuses.

## 2. Typography

Use Inter or a good system sans (`'Inter', 'Segoe UI', Arial, sans-serif`).

- Page headings: 30px desktop, 25px small screens; 750–800 weight; controlled letter spacing.
- Panel headings: 15px / 750.
- Main tabular body: 12–13px; high readability and optional tighter desktop density.
- Data labels: 10–11.5px; descriptive but compact.
- Financial figures use tabular numerals. Right-align quantity and money values.
- No giant marketing headlines on login or across business pages.

## 3. Layout

- Fixed 252px petrol sidebar on desktop. Collapsible overlay navigation on mobile.
- 72px white topbar with breadcrumb, business date, demo/admin indicator, user avatar.
- Max content width ~1650px, 26–38px gutters desktop.
- Card radius ~15px, thin borders and very soft shadows; no heavy gradients or blur.
- Dashboard: compact KPI row, sales vs collections chart, fuel stock, operational priorities and orders.
- Detail pages: clear customer/order identity followed by relevant financial/operational views.
- Customer account: **Overview / Orders & deliveries / Invoices & debts / Payments / Account ledger**, with statement PDF/print access always visible.
- Tables: clear sticky/visible headers where possible, search, filters, server pagination, small row actions, dates and IDs readable.
- Dialogs: narrow (~530px), purposeful field groups, explicit action and cancel.
- Print: separate business documents with narrow branding and no app chrome.

## 4. Roles and security

Only `OWNER` and `OFFICE_EMPLOYEE` are authenticated roles. **Never add any delivery staff account, portal, menu item, API or driver app.** Office personnel print/share non-financial manifests manually. Delivery manifest payload and generated documents are strict allowlists (customer, phone, address, fuel type, scheduled/requested quantity, operational notes) and exclude all finance data.

Owner-only actions: price/unit configuration, stock adjustment, team management, protected purchase costs, audit log, cost/profit details where approved. Staff access to invoicing, debts and payments follows actual existing RBAC. Backend authorization is authoritative.

## 5. Business invariants to preserve

- `Booyad` = large incoming fuel tanker truck; receipt measured in **liters**.
- `Fuusto` = customer-facing smaller sale container; **20 L is only a test/example**, NOT an approved production default.
- Warehouse/in-transit stock is canonical Decimal liters, separate from billable quantities.
- Confirmed orders snapshot price and liters-per-fuusto by fuel/effective date. Rate updates affect new confirmed orders only.
- Requested quantity, dispatched quantity, accepted quantity, returned quantity and in-transit remainder are distinct.
- Customer invoices charge **accepted** quantities only. Unbilled orders never increase posted customer debt.
- Customer statements account for invoices, payments, allocations, unapplied credits and reversals with correct opening/running/closing balance.
- Reports export **all filtered authorized records**, not only the current UI page.
- The customer's final inventory measurement practice, fuusto size, credit policies, freight/tax rules, FIFO allocation default and costing method must remain pending until confirmed by the business owner.

## 6. Page-by-page visual checklist

| Section | Pages / reference screen IDs | Key design elements |
| --- | --- | --- |
| Authentication | `login` | Centered single-card login. No split hero. Clear field labels and error feedback. |
| Dashboard | `dashboard` | KPI row, sales/collections graph, stock by fuel, attention queue and recent orders. |
| Customers | `customers`, `customer-profile`, `customer-ledger` | Customer search and statuses, extensive account tabs, financial KPIs, chronological ledger, print statement. |
| Orders | `orders`, `new-order`, `order-detail` | List/filters, deliberate creation form, saved price snapshot details and status timeline. |
| Fuel inventory | `stock`, `tankers`, `receive`, `tanker-detail` | Warehouse + in-transit stock, movements, tanker register and receipt posting form. |
| Pricing | `pricing`, `price-history` | **Prominent Diesel and Petrol live rates**, owner change-rate action, historical prices and versioned conversions. |
| Delivery | `deliveries`, `manifest`, `dispatches`, `reconcile` | Daily delivery sheets, strictly non-financial print document, dispatch ledger and acceptance/return confirmation. |
| Finance | `invoices`, `invoice-detail`, `payments`, `payment-detail`, `debts` | Invoices, collections, allocation details and aging. |
| Reporting | `reports` | Ten report families, explicit Excel and PDF actions, filterable tables in production. |
| Administration | `audits`, `team`, `settings` | Owner audit log, two-role team view and workspace settings. |

## 7. Component library

Build consistent reusable `AppShell`, `AppSidebar`, `Topbar`, `PageHeader`, `MetricCard`, `DataTable`, `FilterToolbar`, `StatusBadge`, `ActionButton`, `Dialog`, `FormField`, `TabBar`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ConfirmDialog`, `PrintDocument`, `PriceCard`, `LedgerTable`, `ReportCard`, `InventoryBalanceCard`, `FuelTypeBadge`.

Avoid globally changing unrelated package CSS or overwriting existing reusable components without a dependency audit. Prefer shadcn/ui primitives and Lucide React icons, using the actual application's stack.

## 8. Accessibility/responsive

- Keyboard-operable menus, tabs, modals and inputs, focus visible, ARIA labels.
- Desktop 1440px; laptop 1280px; tablet ~768px; mobile ~390px, with horizontal scrolling only inside genuinely wide tables.
- Dialogs close with Escape and return focus to trigger.
- Sidebar must not cause horizontal overflow. Lists and filters wrap gracefully.
- Form validation messages should show below inputs.
- Print layouts may span multiple pages and must repeat table headers.

## 9. Source and limitation

`index.html`, `styles.css` and `app.js` form a self-contained **UI-only design prototype** with illustrative numbers. Navigation, a few search controls, tabs, preview modals, basic form interactions, and browser printing are demo interactions, **not authenticated, not linked to PostgreSQL, and not an authoritative implementation**. Gemini must implement the design within the existing full-stack app without replacing API/business logic or copying mock arrays into production.
