# Product Requirements (PRD)

## Business and goals
One wholesaler receives more than one large fuel tanker truck (**booyad**) of diesel and petrol, then sells fuel to customers in small containers (**fuusto**, e.g., 20L is an illustration, not a configured default). A customer may buy on credit, pay in installments and buy again with prior debt. Selling prices vary by date. Workers carry a printed or shared PDF delivery list that **contains no financial information and requires no user account**. Owner sees real stock and complete downloadable reports.

## Users
- `OWNER`: operational and financial authority; set prices/unit conversions, view cost/profit, approve corrections, run full exports.
- `OFFICE_EMPLOYEE`: front-office operations; register customer, orders, dates, payments, delivery paperwork, record results; no purchase cost/profit or global settings access.
- The physical fuel transporter/recipient of the PDF is **external to the application**, not a user.

## In-scope functional requirements
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Login, logout, OWNER and OFFICE_EMPLOYEE authorization; secure audit | P0 |
| FR-02 | Configure fuel types diesel/petrol, containers and liters-per-container | P0 |
| FR-03 | Receive unlimited tanker consignments, record measured actual liters and supplier/reference | P0 |
| FR-04 | Distinct stock for diesel/petrol, safe movement journal and physical location status | P0 |
| FR-05 | Effective selling-price history and fixed confirmed-order price snapshot | P0 |
| FR-06 | Customer directory, phone and delivery addresses; complete account history | P0 |
| FR-07 | Create, confirm, schedule orders, support orders despite outstanding debt | P0 |
| FR-08 | Print/download date-based **non-financial** daily delivery list | P0 |
| FR-09 | Office manually records ordered vs dispatched vs actually accepted; disposition of difference | P0 |
| FR-10 | Issue invoice for accepted delivery with historical confirmed price | P0 |
| FR-11 | Payments on credit, multiple partial receipts, allocations, unapplied credit | P0 |
| FR-12 | Balance/overdue summary and detailed customer statements | P0 |
| FR-13 | Owner dashboard, employee operational dashboard, filtered PDF and XLSX reports | P0 |
| FR-14 | Stock/payment/price audit, reversals, role and export security | P0 |
| FR-15 | Controlled settings for new container sizes and payment methods | P1 |
| FR-16 | Cashier day-close review and manual payment-method breakdown | P1 |
| FR-17 | Profit reports only when accurate incoming costs + valuation are present | P1 |

## Non-functional requirements
- Data correctness is more important than throughput: concurrent stock, payment and posting requests cannot produce incorrect totals.
- Desktop first with responsive tablet/mobile screens for office use. Keyboard accessible, clear status and error states.
- All monetary amounts stored as fixed decimal in USD by default; single currency in MVP; do not invent FX support.
- Safe reattempts: idempotent transaction endpoints, unique numbers and no double posting.
- Every list paginates server-side, supports basic search and relevant filters; never export more than authorized scope.
- Session and RBAC server-enforced. Daily backup and tested restore process before production.
- UI `Africa/Mogadishu`; DB UTC timestamps. Save operational day separately where required.
- Readable PDF/Excel reports with title/date filter/totals/export timestamp; delivery PDF confidential-finance-free.

## Explicitly out of scope
- Driver account/portal, delivery staff login, GPS tracking, route optimization, vehicle/fleet management, live customer payments gateway, ecommerce customer portal, multi-tenant SaaS, payroll, barcode scanning, tax automation before business confirmation, mobile native application.
- A print action is **not** physical dispatch, acceptance, or proof of payment.

## Definitions of success
A 20-fuusto request accepted at 18 produces a bill for 18, with the 2 handled physically and commercially. An old $100/fuusto sale stays $100 after a price increase to $120. Separate fuel stocks exactly reconcile. A customer can have debt + a new order + multiple partial payments. Delivery paperwork contains zero financial information; all relevant reports filter and export accurately.
