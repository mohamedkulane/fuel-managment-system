# FuelDesk — Order Quantity Variance, Safe Cancellation, Customer Archiving & Staff Permissions

**Audit source:** `mohamedkulane/fuel-managment-system`, branch `master`, branch commit `3f6a88836e3f2fb3c601acb68679821226e74b91` (code inspected 16 October 2026). This is a **static source-code audit**, not a runtime test or deployed-system verification.

## A. Confirmed findings in current source

| ID | Priority | Finding and exact implementation location | Required result |
|---|---|---|---|
| ORD-01 | P0 | `apps/web/src/components/order-delivery.tsx` sets accepted fuusto `max={requested}` and calculates remainder only against original requested units. `apps/api/src/simple-workflows.service.ts` in `delivery()` rejects `accepted > remainingOrder` and `accepted > available`. Customer accepting **more** than ordered cannot be posted. | Owner-authorized, auditable excess quantity or approved amendment to the same order; verify available stock and fixed price snapshot policy. |
| ORD-02 | P1 | Fewer than ordered can be entered, but UI asks only `RETURNED` or `IN_TRANSIT`; there is no simple `Complete with less / Cancel remainder` end state. `simple-workflows.service.ts` automatically dispatches all `remainingOrder` when no prior dispatch exists. | Distinguish `not dispatched`, `delivered/accepted`, `physically returned`, `still in transit`, and `cancelled remainder`; never invent a physical movement to settle an unshipped remainder. |
| ORD-03 | P0 | `apps/api/src/app.controller.ts` exposes `POST /orders/:id/cancel` around lines 1051–1085. It sets `CANCELLED` directly; no required reason/idempotency, no linked payment/dispatch/invoice checks, and no state-conditional lock/reconciliation. | Safe lifecycle-aware cancellation; preserve stock, accounts, payments, invoices, audit. |
| ORD-04 | P1 | `apps/web/src/app/orders/[id]/page.tsx` renders invoice and delivery actions but **no Cancel Order** action. | Conditional `Jooji Dalabka` owner/staff permission-based button and safe confirmation modal. |
| CUS-01 | P1 | `apps/api/src/app.controller.ts` has `GET/POST/PATCH /customers` but no `DELETE /customers/:id`. Customer schema has `ACTIVE/HOLD/INACTIVE`, and UI offers no clear customer archive/delete. | `Tirtir Macmiilka` should normally mean *archive/deactivate* (soft delete) with restore; don't destroy historical finance or relations. |
| IAM-01 | P0 security/design gap | `apps/api/src/auth.ts`: `Actor` has only `OWNER`/`OFFICE_EMPLOYEE`; `SessionGuard` authenticates and loads role only. `User` has no per-user grant model. `docs/02-domain/roles-and-permissions.md` describes fixed role policy. | Persist a **fixed code-defined permission catalog** and dynamic per-employee grants; enforce on server for every endpoint and privileged DTO. |
| IAM-02 | P1 UI/security | `apps/web/src/components/app-shell.tsx` shows all eight sidebar sections to staff by default. `apps/web/src/app/settings/page.tsx` manages users/roles but no page or CRUD permission matrix. | Owner-managed permission toggles; hide ungranted navigation/actions; show staff only allowed data; real API `403` for disallowed actions. |

## B. Clarify operational quantities

Keep immutable original order request and audited revision history. The user-facing `Xaqiiji Gaarsiinta` form should show *Dalabkii* (original), *La diray* (physically sent), *Macmiilku qaatay* (accepted), *Soo noqday* (physically returned), *Aan la dirin* (never shipped), and clear result. Do not make the owner fill all numbers: show only `Macmiilku qaatay`, then conditionally show what happened to leftover fuel and whether to close the remainder. System derives the rest where safe.

**Less than ordered:** e.g. originally ordered 10 fuusto, accepted 7: invoice 7 at snapshotted price; stock decreases only by physically accepted/actually in transit, never invent a dispatch of 10 when 7 were dispatched; for dispatched 10 and accepted 7, record 3 either physically returned or still in transit; if 3 were not dispatched, they stay in warehouse. Offer `Dhammaystir 7; jooji 3-da harsan` versus `3-da harsan dib u gee`. One finalized partial order must not stay forever in a pending status if its remainder is closed. If the user has paid ahead, reserve the payment to the same order and expose excess as pending resolution; never silently transfer to old debt.

**More than ordered:** e.g. originally 10, accepted 12. Physical accepted quantity cannot be recorded above *physically available and dispatched* fuel. Before posting, require an auditable `Kordhi tirada dalabka (+2)` amendment authorized by Owner (or an explicitly delegated elevated permission), a supply/dispatch reconciliation for the extra 2, and a clear final price for those additional units. Default suggested policy: retain original confirmed price for amended units **only if approved as part of this order**; any different price requires explicit Owner approval. Do not silently reprice old line items. Show original 10, amendment +2, accepted 12, final 12. Prevent credit-limit and inventory overrun. If physical fuel was already handed over, use a controlled after-the-fact correction workflow rather than mutating invoices.

**Amount calculations:** final invoiced amount must use *accepted quantities* and valid order/extra price snapshots, not ordered quantity. Reconcile fixed order discounts correctly for partial or revised quantities; discounts must not silently grow or be fully consumed by a partial delivery if the business rule calls for proration. Customer `Paid Now` stays attached to the same order; excess/unapplied amount remains visible for explicit Owner resolution.

## C. Cancellation and archive policy

- **Pre-dispatch, no money received:** cancel an order with a reason; no stock movement, no debt.
- **Pre-dispatch, Paid Now received:** preserve original payment, financial account Money In, and customer history; mark amount `needs Owner resolution` for documented refund/carry-forward. No implicit refunds, no auto allocation to old debt.
- **In transit:** do **not** cancel stock-in-transit away. First reconcile physical fuel returned, accepted or still in transit. Cancel only the unfulfilled remainder once safe.
- **Partially delivered:** preserve posted invoices and accepted stock movement; `Jooji inta Harsan` cancels only the remaining promise, not the delivered sale.
- **Fully delivered/posted:** do not erase or cancel existing financial history; use controlled adjustment/credit-note or approved correction workflow.
- **Customer delete:** use `INACTIVE`/archived with `archivedAt`, `archivedById`, reason and restore. Hide from active pickers, but retain for statements, collections, historical invoices and audits. If customer has balance or open orders, require Owner authorization and a warning; never hard-delete payment/ledger data. A truly unused customer may still be archived rather than permanently deleted for simplicity.

## D. Backend-defined permission catalog, owner-managed grants

**Architecture:** keep only `OWNER` and `OFFICE_EMPLOYEE`; do **not** add dynamically created roles or arbitrary user-written permission strings. Define `PermissionCode` in backend shared constants; owner grants or revokes a subset per employee in PostgreSQL (e.g. `UserPermission` unique `(userId, code)`, actor, timestamp; ideally permission-change audit). OWNER is immutable superuser. Staff must never edit their own grants, elevate themselves to Owner, change financial/audit security policy or permissions.

Suggested permission codes (fixed, extend only deliberately):

- `dashboard.view`
- `customers.view`, `customers.create`, `customers.update`, `customers.archive`, `customers.restore`
- `orders.view`, `orders.create`, `orders.amend`, `orders.cancel`, `orders.delivery.confirm`, `orders.delivery.overage_approve`, `orders.invoice.view`
- `stock.view`, `stock.receive`, `stock.adjust`, `stock.purchase_cost.view`
- `suppliers.view`, `suppliers.create`, `suppliers.update`, `suppliers.pay`
- `expenses.view`, `expenses.create`, `expenses.reverse`
- `accounts.view`, `accounts.create`, `accounts.transfer`, `accounts.movements.view`
- `payments.view`, `payments.record`, `payments.reverse`, `payments.receipt.view`
- `reports.view`, `reports.export`, `reports.financial.view`, `reports.profit.view`
- `prices.view`, `prices.update`
- `settings.view`, `settings.manage`, `users.manage`, `permissions.manage`, `audit.view`

Security invariants: permission to view a page is **not** permission to mutate it. Protect API and PDF routes, read fields, totals and exports; server must apply exact codes, not merely hide frontend buttons. Use deny-by-default for missing grants; fail safely on unknown codes. Permission changes take effect on the next request, invalidate web `me/permissions` queries and staff sessions' effective authorization; audit who changed what, when and why. Clearly designate permanently OWNER-only actions (permission administration, audit-policy modification and other high-risk actions decided in business policy). Financial and purchase-cost visibility must be independently permitted, not bundled with `stock.view` or `dashboard.view`. Owner must be able to grant a staff member ONLY `dashboard.view`, OR `customers.view` only, OR `customers.view + customers.create`, as requested.

UI in **Dejinta > Shaqaalaha > Ogolaanshaha**: clean permission matrix grouped by eight existing sidebar sections. For each section checkbox `Eeg` (`view`) and only applicable `Ku dar`, `Wax ka beddel`, `Jooji/Tirtir` plus special scoped actions; no irrelevant generic CRUD (e.g. dashboard has only `Eeg`). Offer `Eeg keliya` shortcut and optional safe templates but allow overrides per employee. Inaccessible sidebar links and actions disappear; a direct URL or direct API request returns 403. Do not create a new main sidebar page.

## E. Codex implementation instruction — execute every phase without asking for “Next”

**TASK:** Verify all findings against the current branch before changing code. Then implement these phases in order, with tests after each phase. Do not stop after writing an audit. No production deployment, no destructive migrations, no retroactive mutations of immutable invoices or ledgers.

### Phase 1 — Inventory of current lifecycle and permission boundaries
Inspect `apps/api/src/app.controller.ts`, `apps/api/src/simple-workflows.service.ts`, `apps/api/src/auth.ts`, `apps/api/src/financial-workflows.service.ts`, `apps/web/src/components/order-delivery.tsx`, `apps/web/src/app/orders/[id]/page.tsx`, `apps/web/src/components/customer-account.tsx`, `apps/web/src/app/customers/page.tsx`, `apps/web/src/app/settings/page.tsx`, `apps/web/src/components/app-shell.tsx`, Prisma schema, migrations, tests and both simple and legacy dispatch/reconciliation routes. Confirm and prioritize the above findings. Document current API behavior, pending reservations, stock/dispatch lifecycle and financial constraints.

### Phase 2 — Correct delivery confirmation for less, equal, and more
Implement a single safe reconciliation domain service called by simple and legacy endpoints, with transactional atomicity, serializable/idempotent writes, authorisation, validated whole-fuusto quantities and nonnegative stock. Split original quantity, amendment quantity, dispatched, accepted, returned, undelivered, cancelled remainder. Allow smaller accepted quantity and deliberate `close remainder` option. For bigger accepted quantity, require explicit approved amendment, real physical stock/dispatch evidence and frozen or Owner-approved price for extra quantity before posting. Fix related order status and discount/proportional invoice/paid-now logic. Never silently adjust historical finalized invoices.

### Phase 3 — Lifecycle-safe cancel actions
Refactor `POST /orders/:id/cancel` to use required reason, idempotency key and conditional transaction; do not permit cancellation that skips payment/dispatch/invoice reconciliation. Implement a `cancel remainder` operation for partials. Add `Jooji Dalabka` / `Jooji inta Harsan` UI actions with warnings and role/grant checks; completed sale never disappears. Add audit and regression tests.

### Phase 4 — Customer archive/restore
Add Owner/delegated `Tirtir Macmiilka` as soft archive, with reason and `Soo celi`, protected against orphaned financial records. Keep archived customer history readable and receivables collectible (subject to permitted action). Hide archived customers in new-order pickers; provide filter to find and restore them. Consider completely unused customers but default to archive, not hard-delete.

### Phase 5 — Dynamic per-staff authorization from a fixed catalog
Define permission codes in server/shared source; add safe Prisma migration with `UserPermission` or equivalent and audit/history. Provide Owner-only list/update grants endpoints, authenticated current grants endpoint, and server-side guard/decorator/policy that checks **every** legacy and new API/PDF/report endpoint and field sensitivity. Review office-only and owner-only existing constraints explicitly. Deny by default; no silent broad allow. Build simple Owner matrix under Settings and permission-aware navigation, pages, actions and data fetch. Prevent staff privilege escalation. Decide and document a safe migration behavior for existing staff grants before enforcing, preferably owner-reviewed defaults that avoid unexpected production access/outages.

### Phase 6 — UI simplification & Somali language
Compact delivery confirmation: one accepted quantity input; conditional leftover result; show original/approved quantity and derived figures; a clear excess-approval action for Owner. Compact cancellation warning, archive confirmation and permissions matrix. Translate all buttons, labels, toasts and error messages into consistent natural Somali. Keep FuelDesk visual design. No extra top-level sidebar pages; eight existing sections remain.

### Phase 7 — Security, integration, and browser tests
Required test scenarios: order 10 -> accepted 7 -> 3 never dispatched closed; 10 dispatched -> accepted 7 -> 3 returned; 10 -> 7 with 3 remaining in transit; 10 -> accepted 12 with approved +2 amendment and stock; unauthorized excess rejected; no stock -> reject; under/over accepted amount invoices accurate; price snapshots fixed; partial discount; paid-now excess preserved; concurrent repeated confirmation exactly once; cancel without dispatch; cancel with Paid Now; cancel in transit blocked until reconciliation; partial cancel remainder preserves invoices; completed cancellation refused; customer archive with/without invoices and debts; restore; staff view-only dashboard; customer-view-only; customer-create-enabled but update denied; hidden sidebar with 403 direct API; PDF routes access denied; no cost leakage; immediate grant revocation; self-escalation impossible; owner unaffected; no driver login. Run Prisma validation and migration checks, TS typecheck, lint, relevant unit/integration suites, production build and responsive browser checks if environment supports. Report actual results and limitations; do not claim tests passed unless run.

### Phase 8 — Final re-audit
Recheck code, confirm each audit gap resolved or report blocker, enumerate migrations/files changed, DB rollback/backups, all test results, remaining P0/P1/P2 and production readiness. Continue sequentially without asking me for next phases; stop only when an irreversible financial business-rule decision is genuinely ambiguous. **Do not deploy to production.**
