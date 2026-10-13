# FuelDesk — V6.1: Simple Orders, Order-Based Customer Accounts, Clear Payments & Safe Corrections

**Authority:** V6.1 replaces V6 where there is any conflict. This is the consolidated specification: it retains every V6 requirement and adds the Owner-approved **Option A** for debt payments (oldest debt first) plus the order-based customer-account presentation. It supersedes earlier proposals about order confirmation, deposits, unnecessary invoice screens, and customer-visible unapplied credits.
**Scope:** Existing repository `mohamedkulane/fuel-managment-system`. Change the working application—not just text and sidebar links. Do **not** deploy without permission.

## 1. Confirmed user workflow

1. The owner/office employee picks a customer, fuel, whole-number fuusto, current price, optional fixed **total order** discount, and optional **Paid now** amount, then clicks **Save Order** once.
2. A regular saved order is **immediately recorded/accepted**. There is **no separate Confirm Order button**, no user-facing Draft-versus-Confirmed journey, and no extra confirmation page. Internally preserve a valid order status and immutable price snapshot, with the saved date/time and actor.
3. Only if an **OFFICE_EMPLOYEE** requests a negotiated discount requiring owner approval may the order await one **Approve Discount** action. Once approved, make it ready automatically; never require a subsequent generic confirmation. An owner-approved discount may be applied immediately. Never allow unapproved discounted orders to ship or be billed.
4. **Paid now** is *money paid toward this particular order*, not a free-standing payment against prior debt. Store it with an `orderId`, preserve receipt/audit details, show it on that order immediately, and do not use it to reduce unrelated previous balances.
5. The user sees `Total`, `Paid`, `Remaining` on the order. Use `Order remaining` while pending delivery, then `Debt` after accepted delivery / invoice posting. The ledger must clearly distinguish future/order obligations from posted accounts receivable. Do not present as posted sales before actual acceptance when the accounting architecture invoices on delivery.
6. If actual delivery is fewer fuusto, bill only accepted fuusto using historical agreed price and appropriately allocated fixed total discount. Preserve return/in-transit reconciliations. If a prepayment exceeds the final bill, visibly flag a **customer refund/adjustment requiring Owner review**. Do not silently turn it into extra revenue, delete it, or hide a nonzero amount; business refund policy needs approval.
7. The driver does not log in. One printable/PDF daily list resides within Orders, without financial fields. The Owner can select any delivery date and open its historical list; historic lists must not disappear merely because the related orders are fulfilled.
8. Confirmed unit and pricing rules remain: **1 Fuusto = 240 liters**, whole fuusto quantities only, Naafto and Basiin separate, price changes independent and effective only for new orders. Fixed optional discount is one amount for the entire order, never per fuusto or percent. Optional purchase cost is Owner-only; incomplete cost must never be counted as zero profit.

## 2. Payment recording and corrections

### `Pay` on a customer account
- Show **Customer**, **Debt: $X**, **Amount ($)**, **Remaining: $Y**, and `Cancel` / `Pay`.
- A regular debt payment must be `>0` and **cannot exceed verified available old debt**; `Pay` disabled when zero. Recalculate and enforce on the server in a transaction; block simultaneous payments that together exceed the debt.
- Money reserved for a newly created order must **not reduce old debt**. Calculate old debt using outstanding posted invoices less only available *unrestricted* credit (after examining attribution); do not subtract order-linked prepayments.
- Use exact Decimal/NUMERIC money calculations, not JS floating point.
- **Option A (confirmed):** for a debt payment without an order specified, allocate automatically to the **oldest posted unpaid customer obligation first (FIFO)**, then the next. Tie each allocation to the underlying order through the accepted-delivery invoice relationship; do not require the user to choose an invoice or order. Deterministic tie-breaker: issue date then ID. Never allocate general debt payments against a not-yet-delivered order.

### `Paid now` when creating an order
- Optional; zero is fine. Nonzero amount cannot exceed the net total of that order. It is tied to that order as a legitimate order payment.
- The interface must **never** label this `Unapplied Amount`, `Deposit`, or `Customer Credit`. Display: `Paid Now`, `Order Paid`, `Order Remaining`.
- The accounting layer may hold amounts pending accepted delivery; keep traceable reservation/attribution and reconcile when delivered. Don't falsely claim it has been allocated to a not-yet-existing invoice; don't make order-specific funds available to pay another order.

### `Reverse Payment` (owner-only)
- In the **Customers > Payments** tab, for a non-reversed payment show a compact `Reverse` action in the row/overflow menu. No extra sidebar item.
- Require a confirmation dialog with payment reference, amount, customer, order association (if any), and **mandatory reason**; no direct Delete/Edit on posted amounts.
- Existing `POST /api/v1/payments/:id/reverse` must be integrated/verified for both order-linked prepayments and allocated debt payments. A new `simple` alias is optional; share *one* authoritative reversal service.
- Reverse once, atomically: mark payment REVERSED; restore invoice remaining amount/payment statuses for each allocation; release any order-linked prepayment reservation; add opposite audit/ledger event; refresh order, customer, payments, dashboards and reports; show a success toast only after commit.
- Concurrency-safe **exactly once** reversal: check status *inside* transaction, use a guarded conditional update/locking with a unique per-payment reversal constraint (or equivalent), and protect retries with idempotency. Never allow two concurrent clicks to double-credit debt.
- Original payment must remain visible as `Reversed`, alongside the correction event and reason. For wrong `$50` instead of `$40`: reverse `$50`, then record a new `$40`. Do not overwrite the old posted record.
- Avoid double subtraction/addition in ledger and status restoration on retries. Ensure customer statement, reports, and PDF show reversed transactions consistently.

## 3. NEW IN V6.1 — Order-based customer account (business-owner approved)

### 3.1 Design principle and navigation

- The owner understands money by **Customer → Order → Paid → Remaining**, not by `Debit / Credit / Allocation / Unapplied Amount`.
- Do **not** create separate pages, new sidebar items, invoice-management steps or a second ledger. Reuse existing six navigation sections. Customer details should contain only three clearly distinguishable tabs (or sections): **Xisaab (Account)**, **Dalabyada (Orders)**, **Lacagaha (Payments)**.
- Use compact, readable Somali + short English where helpful. Short action labels: `New Order`, `Pay`, `Statement`, `View`, `Reverse`. No repeated Print/Download/Invoice action buttons.
- Do not show a mixed list of all sales and payments as the only default customer-account view. The default **Xisaab** view presents an account summary and **one row/card per order**. Detailed payment events are available under each order and in the **Lacagaha** tab.

### 3.2 Customer summary: financial accuracy, not misleading arithmetic

- Display at least three prominent values: **Total Sales** (only *accepted/delivered and posted* sales), **Total Paid**, and **Remaining Debt** (actual unpaid posted receivables, reflecting valid allocations); show customer money awaiting delivery/refund review separately **only if applicable**.
- Distinguish **Total Paid received** from **Payments applied to delivered sales** when order-linked pre-delivery money exists. Never calculate actual debt as `Total Sales - all cash ever received` if some cash is reserved for unfulfilled orders or a refund is pending.
- **Pending Order Remaining** is NOT posted customer debt. A customer may have old debt $70 and a second undelivered order with total $500, Paid Now $100: show **actual debt $70** and **new order pending $400** separately. Do not report $470 as outstanding receivables until the new order has actually been delivered/billed.
- Never render negative debts. A negative net accounting position must be classified accurately (for example, a specific order payment awaiting delivery or an excess-payment refund requiring owner review), not silently labeled as `Customer Credit` on all payments.

### 3.3 Order row / expandable card specification

Each order row or card shows (as applicable):

- Short **Order No**, order date, **Fuel** (`Naafto` / `Basiin`), whole-number **Fuusto** (requested and actually accepted clearly differentiated), current delivery state.
- **Agreed Total** based on historical price snapshot and one fixed order discount; **Delivered Total** after reconciliation based strictly on accepted fuusto, including correct partial-delivery allocation of the single fixed discount.
- **Paid on this order** (order-linked Paid Now plus any later debt-payment allocations *actually assigned to this order*), and either **Order Remaining** (still awaiting delivery) or **Debt** (only the posted outstanding balance for accepted delivery).
- One optional `View Payments` disclosure reveals dated payment records with amount, method (if useful), posted/reversed status and concise reference. Avoid requiring the owner to know which invoice the payment was allocated to.
- One general payment can cover multiple orders under FIFO. Its monetary value must appear only **once** in overall total payments; show its split allocations under the relevant order cards for transparency without double-counting.

#### Core walkthrough A — one fully delivered order

| Order | Delivered Sale | Paid Now | Later Paid | Remaining Debt |
|---|---:|---:|---:|---:|
| ORD-001 | $240.00 | $100.00 ($50 + $50) | $70.00 | **$70.00** |

Expected top summary for this case: Total Sales $240.00; Total Paid $170.00; Remaining Debt $70.00. The user must never have to interpret unexplained running `Customer credit $50 / $100` labels.

#### Core walkthrough B — existing debt plus a new order

| Order | Accepted sale / current stage | Paid toward order | Remaining |
|---|---|---:|---:|
| ORD-001 | Delivered $240 | $170 | **Debt $70** |
| ORD-002 | **Not delivered**; order total $500 | Paid Now $100 | **Order remaining $400 (not debt)** |

Show overall actual debt **$70**, plus a separate pending-order amount **$400**. After full accepted delivery of ORD-002, assuming no further payment/reversal and no price/quantity changes, actual overall debt becomes **$470**, Total Sales $740, Total Paid $270.

### 3.4 Option A — automatic oldest-debt-first payment assignment (confirmed)

- When the Owner selects a customer and clicks **Pay**, no order selection is required. On successful payment, settle the oldest *eligible delivered unpaid* order debt first, then the next (backed by invoice allocations). This **Option A** overrides any earlier suggestion that the Owner should normally select which order to pay.
- Example: Delivered ORD-001 debt $70, delivered ORD-002 debt $400, customer pays $100. Apply $70 to ORD-001 and $30 to ORD-002; resulting debts $0 and $370. Customer actual debt becomes **$370**.
- **Important:** when ORD-002 is still undelivered, its pending $400 must NOT participate in FIFO debt allocation. A $100 general debt payment with only $70 actual old debt must be **rejected as exceeding the actual debt**, not partially allocated to future ORD-002.
- Order-specific **Paid Now** must remain reserved for the newly placed order. Do not apply it to ORD-001 when ordering ORD-002. Later successful general debt payments are linked by payment allocations to eligible orders, with a complete audit trail.
- Implement exact, server-side decimal math, deterministic FIFO ordering, cross-customer safeguards, transactional/serializable concurrent collection, replay-safe idempotency, and clear handling of reversals. Reuse existing invoice/allocation models internally; **do not expose invoice-management screens**.

### 3.5 Statements and payment history

- The on-screen **Xisaab** page and `Statement` PDF must share the same authoritative server-side accounting and order-payment relationship: summary, clear order-by-order totals and remaining amounts, and (where helpful) indented payments per order. Do not show a naked mixed ledger as the only user-facing report.
- The **Lacagaha** tab remains an independent, **chronological collection log** (Date, Amount, Related Order/Multiple Orders where applicable, Status, `Reverse` for Owner); it is NOT another financial total or contradictory parallel ledger.
- The statement must respect the selected date range and show accurate opening balances **including periods without transactions**. Handle cash collected before acceptance distinctly; never recognize undelivered order totals as sales. Make PDF monochrome (white, black, gray, thin rules; no dark table headers or colorful design), readable on A4, with short unique display references (do not mutate internal IDs), and a single `Statement` action opening PDF for print/download using the browser viewer.
- Any reversal must update the attributed order's paid/remaining totals, customer summary, payment history, PDF and reports **exactly once**. Preserve history rather than deleting/rewriting an original payment.

### 3.6 Necessary backend mappings (no invented payments)

- Build the view as read models from `SalesOrder`, `SalesOrderLine`, delivery acceptance / invoice records, `Payment.orderId` for Paid Now, `PaymentAllocation` for later payments against delivered sales, reversal statuses and any legacy exception records. A `Payment.orderId` is **not** the only way to identify an order's paid amount; debt payments may be spread among several invoiced orders. Follow invoice -> delivery confirmation -> order line -> order.
- Existing pre-delivery `unappliedAmount` is an **internal accounting holding field**. Keep historical records intact; make its ownership/attribution explicit, and avoid using reserved prepayments as general credit against old debts. Any truly unlinked or overpaid legacy amount requires an Owner review/exception state, not guessed assignment and not silent hiding.
- If multiple order lines, multiple delivery confirmations or split invoices exist, deduplicate by source IDs and reconcile amounts so a payment is not counted twice. Preserve the exactly-once billing and immutable confirmed-price principles.

## 4. Reporting and customer statement

- The current **Payment Collections** report exposes `Allocated Amount`, `Unapplied Amount`, long `PAY-...` numbers, four decimal places and unnecessary columns. Replace these user-facing columns with only `Date | Customer | Order (if relevant) | Paid | Status | Recorded by` (where useful). Optional method in compact secondary view; show cents (`$50.00`), not `$50.0000`.
- **Never merely hide actual unidentified credits.** Audit and classify historical rows, showing a clear `Needs review` state for unresolved legacy balances. Provide an Owner-only reconciliation checklist; do not invent associations.
- If an order's payment is recorded before delivery, its report label is `Order payment`; after delivery it may display as settled/allocated internally, without additional user-facing accounting fields.
- Include reversals in report filtering so `Total collected` means **net non-reversed collections**, and reversed amounts are clearly accounted for.
- Customer statement: **prefer V6.1 order-based summary** (`Order | Accepted Sale | Paid | Remaining`) with optional nested payments. A chronological audit timeline may remain secondary, never the sole default account presentation. Show clear `Debt $X`, `Pending order $Y` (if any), or `Money to review $Y` for genuinely unresolved excess; no confusing negative-debt or generic credit display.
- Printed/PDF customer statement must match date-filtered on-screen data, dates in business timezone, complete opening and closing balances, no long reference wrapping. Single `Statement` action opens browser-printable PDF (not separate Print/Download buttons).
- Use short Somali-English business labels and remove accounting words from customer-facing pages. Keep finance internal models/API stable unless safe changes are required.

## 5. Real repository review points (verified by source inspection)

- `apps/web/src/app/orders/page.tsx` currently sends `/orders/:id/confirm` and renders a draft-specific Confirm action. Remove this **user journey** after implementing valid atomic auto-finalization.
- `apps/web/src/app/orders/[id]/page.tsx` also renders `Confirm Order` or `Approve Discount & Confirm`; replace with a **discount-approval-only** action where needed.
- `apps/web/src/app/orders/new/page.tsx` posts to `/simple/orders` with `paidNow`, and can show `DRAFT` if staff request discount. Preserve price snapshots and price-change protection while simplifying workflow.
- `apps/api/src/simple-workflows.service.ts`: `order()` creates an order-linked payment and `collect()` posts it with `unappliedAmount = amount`, later allocated on delivery. `payment()` subtracts **all** posted unapplied credit from old debt. These need attribution-safe separation.
- `apps/api/src/app.controller.ts` provides both `POST /payments` and `POST /payments/:id/reverse`; verify policy parity with `/simple/payments` and make the reversal available in the simplified UI.
- `packages/database/prisma/schema.prisma`: `Payment.orderId` already exists; `PaymentReversal.paymentId` is **not unique** at source inspection. Audit the exactly-once safeguards and add a safe migration if necessary.
- Do not remove the underlying invoice or dispatch/reconciliation accounting models just because user-visible invoice/confirm pages are unwanted.

## 6. Tests required (real PostgreSQL integration + browser checks)

1. Owner saves a regular order: exactly one posted/operationally active order; no additional Confirm button or post.
2. Office saves regular order: same behavior.
3. Office requests fixed order discount: only Owner approval; after approval no further generic confirm. Invalid rejection paths are safe.
4. Price changes between order saves: each order retains its own effective snapshot; no second confirmation needed.
5. New order $500; Paid now $100 => order shows $100 paid/$400 remaining; prior debt unchanged.
6. Customer has old debt $200; creates a new $500 order with $100 Paid now; `Pay` for old debt still allows exactly $200.
7. Customer has no old debt and an undelivered order with $100 Paid now => cannot pay arbitrary extra money via old-debt `Pay` form.
8. Delivered 20 fuusto, accepts 18, returns 2 => invoice only 18; payment attribution and total discount reconciled; excess order payment prompts review where applicable.
9. Customer Debt $300 => debt payment $400 rejected server-side. Concurrent $200 + $200 requests cannot overpay $300.
10. Wrong posted payment $50 => Owner reverses; original preserved; corrected $40 posted => net valid payment $40; statement/report/ledger all reconcile.
11. Reverse a payment partially or fully allocated across multiple invoices => all invoice balances/statuses restored exactly.
12. Reverse an order-linked prepayment before delivery and after partial/full delivery; no dangling allocations; no corruption.
13. Two simultaneous reversal requests => one reversal, one ledger counter-entry, one audit reversal event.
14. Office employee cannot reverse payment (backend returns 403); Owner can.
15. Payment report shows `$50.00`, correct net collections, clear status, no internal allocated/unapplied columns.
16. Existing historic payments, invoices, and ledger rows survive migration untouched; unresolved legacy balances flagged, not hidden.
17. All flows at 320, 375, 430, 768, and 1440 pixels; no horizontal overflow, duplicate actions or unnecessary pages.
18. Unit tests, full integration suite, typecheck, lint, production build, browser E2E all run and are reported PASS/FAIL/BLOCKED honestly.

### Additional V6.1 acceptance tests (required)

19. Four-event example: order #1 accepted $240, Paid Now $50+$50, later general debt payment $70 => correct order-paid total $170, remaining debt $70; one global customer cash total $170, with no double counting.
20. Debt $70 on delivered order A + undelivered order B $500 with Paid Now $100 => `Pay` old debt supports $70, B keeps $100 reserved, actual debt $70 before payment / $0 after; pending order B $400 unchanged.
21. Two fully delivered unpaid orders: A $70 and B $400; general Pay $100 => FIFO allocation A $70 and B $30; updated balances A $0, B $370; exactly one payment event and no double count in totals or PDF.
22. Only old debt $70 and pending order $400 => generic Pay $100 is rejected, never partly allocated to pending order.
23. Order #2 fully delivered after Paid Now $100 (total $500) => debt $400; if there was previous delivered debt $70 and no additional settlements, summary debt is $470; paid $100 attributed exclusively to #2.
24. Date-range without any customer events: opening debt carries forward and closing debt equals opening debt, not zero/dash. UI, PDF and Excel (if retained for reports) match.
25. A general Pay split over several orders followed by Owner reversal restores all affected order balances and one customer aggregate exactly; two concurrent reverse attempts yield exactly one counter-event.
26. One partial delivery, one order total discount, multiple delivery confirmations, order-linked advance and later FIFO payment: no duplicate discount, invoice, allocation, paid or debt totals.
27. Customers with legacy unlinked credit: Owner-only `Needs review`; not hidden, not mislabeled and not applied to unrelated orders without explicit verified policy.
28. Customer Account defaults to summary plus order-based breakdown; `View Payments` explains each amount; chronological payments tab and monochrome PDF accurately agree; mobile no overflow.
29. Staff role sees valid order financial records but cannot reverse payments or independently approve discounts; authenticated API permissions tested.

## 7. Delivery procedure for Codex

**Phase A — audit:** Read `AGENTS.md`, source files above, and any previous V4/V5 directives; identify conflicts and missing test coverage. Propose migration plan. Create a backup; do not reset production data.

**Phase B — fix business logic:** Implement payment attribution, **Option A oldest-eligible-debt FIFO**, constrained collection, reversal correctness, accurate order-level paid/debt read model and new-order auto-finalization. Test DB financial invariants before changing UI.

**Phase C — simplify UI:** Keep six-sidebar structure (`Dashboard`, `Customers`, `Orders`, `Stock`, `Reports`, `Settings`); compact card/table UI, **three customer detail tabs** (`Xisaab`, `Dalabyada`, `Lacagaha`), **order-based default account view**, short labels, no invoice page, one statement action, payment correction inside customer Payments, responsive/mobile-first.

**Phase D — verify & report:** Independently reconcile stock, order payments, invoicing on accepted delivery, financial ledger, reversal, and report data. Deliver exact files changed, migration plan/results, test evidence, browser screenshots, and remaining decisions. Do not declare done if any finance test fails.

**Restrictions:** Do not delete history; do not treat pre-delivery receipts as recognized sales; do not silently reinterpret the accounting of past `unappliedAmount` rows. Do not apply new-order reserved funds to old debt; do not count payments twice across orders. Do not remove audit trails, price histories, discounts or actual-delivery confirmation. No driver role, no extra sidebar pages, no real production deployment.

**Acceptance gate:** Codex must show exact pre/post data totals for the example scenarios, DB constraints/migrations (if any), test output, and mobile screenshots. Report PASS/FAIL/BLOCKED honestly; do not claim financial completion based on TypeScript compilation alone.
