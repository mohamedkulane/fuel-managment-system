# Simple FuelDesk UX — design checkpoint

Date: 11 October 2026. Status: proposed; awaiting user approval. No application implementation or database changes made for this design checkpoint. The mockups contain illustrative data, not live balances.

## Review findings

Read AGENTS.md, FUEL_SIMPLE_UX_CODEX_BRIEF.md, README.md, start-here and decision log. Reviewed the Next.js route inventory, shared navigation, customer account queries, new-order and payment forms, stock pages, and API receipt/order/dispatch/reconciliation/invoice/payment boundaries. Inspected the running Dashboard, Customers, Orders and Stock in the browser and the supplied V4 visual references.

The present interface has 14 navigation links, small labels, repeated metrics, and a workflow spread across separate documents. Customer profiles already expose separate invoice debt and unapplied credit, but five tabs make everyday work harder. Orders currently require draft creation and later confirmation; stock receiving requires creation and posting. Delivery, reconciliation and invoicing are separate operations. Payment entry exposes invoice allocations. These operations must remain financially correct when the visible steps are reduced.

## Existing routes → proposed navigation

| Existing routes (all 23 pages) | Proposed home / treatment |
| --- | --- |
| `/` | Guudmar: exactly four figures, three everyday actions and today's orders |
| `/customers`, `/customers/[id]` | Macaamiisha: searchable list with current invoice debt; account with Xisaabta, Dalabyada, Lacag-bixinnada |
| `/payments`, `/payments/[id]`, `/debts` | Customer account payment/debt entry points; keep secured receipt details and historical links |
| `/orders`, `/orders/new`, `/orders/[id]` | Dalabyada: list, simple new-order form, contextual details and actual-delivery action |
| `/deliveries`, `/deliveries/[id]` | Orders → today's delivery list and allowlisted print/PDF |
| `/dispatches`, `/dispatches/[id]`, `/dispatches/[id]/reconcile` | Orders → delivery actions; preserve secured operational history and physical stock accounting |
| `/invoices`, `/invoices/[id]` | Customer/order account document links; retain secured invoice and reversal access |
| `/stock`, `/stock/receive`, `/pricing` | Kaydka Shidaalka: two fuel balances, receiving, current prices and expandable histories |
| `/reports` | Warbixinnada: customer debts, sales, collections, stock; print/PDF/Excel |
| `/settings`, `/audits` | Dejinta: owner-only advanced team, policy and audit access |
| `/login` | Remains authentication entry; same accessible visual system |

Old detail links must retain their record context and a clear back action. List redirects must preserve meaningful filters. Removing navigation links does not authorize deleting endpoints, ledger models or records.

## Four page proposals

- **Guudmar:** diesel fuusto, petrol fuusto, today's collected cash and current invoice debt. No profit, charts or top-five panels. Undelivered orders have a plain alert. Stock means warehouse stock; underlying transit history remains accessible contextually.
- **Macaamiisha:** name/phone search; name, phone, location, current debt, Eeg xisaabta. One Macmiil Cusub action. No redundant status metrics. Account details lead with debt, show unapplied credit separately, then chronological history and Lacag Qaado / printable statement.
- **Dalabyada:** search/date, Dalab Cusub and nonfinancial daily list. Amount/paid/remaining shown with estimate versus actual labels. Eeg opens details and actual-delivery action. Office discount requests show Sugaya oggolaanshaha milkiilaha in place.
- **Kaydka Shidaalka:** two large fuel balances, fuusto primary/liters secondary; receiving action; current per-fuusto prices and owner price edit. Receiving/history are contextual. Purchase costs do not appear on this landing page.

## Four principal forms and secondary actions

1. Macmiil Cusub: name, phone, address; notes collapsed; Kaydi.
2. Shidaal Soo Geli: fuel, fuusto, date today; live 240 L conversion. Optional owner cost per fuusto OR total, supplier and notes in disclosure. Kaydi oo ku dar kaydka.
3. Dalab Cusub: searchable customer, fuel, fuusto, current read-only price; inherited contact/address. Optional fixed whole-order discount, Hadda la bixiyey and note. Review price changes before confirmation. No unit selector or deposit entity.
4. Lacag Qaado: customer preselected, amount, optional method/reference. No allocation matrix.

Delivery confirmation asks accepted fuusto and, only when necessary, whether the remainder returned or is still travelling. Printing never confirms dispatch. Price editing is a small owner-only action. Account hold, reversals and stock adjustments stay secured contextual/advanced actions with reasons and audit records.

## Integrity risks / decisions before implementation

| Risk | Required treatment |
| --- | --- |
| Existing payment API automatically allocates to oldest invoices when allocations are absent | Explicit owner policy required. The proposed order-time payment must remain customer credit before accepted delivery, including when old debt exists. An empty allocations array currently does not express this intent. Do not silently reuse that behavior. |
| Create/confirm/dispatch/reconcile/invoice are separate endpoints | Use safe server orchestration or a resumable idempotent operation, with honest partial-failure status. Never hide a chain of independent frontend writes behind one success message. |
| New customer list requires authoritative debt, which current customer list DTO lacks | Add/reuse an authorized aggregate query; do not sum only the current page or treat unbilled orders as debt. |
| Orders lack a complete order-time payment attribution workflow | Agree allocation/association semantics before displaying money as paid toward a particular order; current customer credit is not automatically order payment. |
| Partial accepted delivery and split invoices | Preserve quantity/conversion/price snapshots and capped proportional fixed discount; bill accepted quantity only; explicitly account for remaining physical fuel. |
| Simplified dashboard changes metrics and day scope | Use server aggregates and Africa/Mogadishu dates; collections are not revenue; debt excludes unbilled orders and does not silently net unapplied credit. |
| Financial data leaking through daily print | Use delivery allowlist DTO only, including HTML, hidden DOM, PDF metadata and exports. |
| Hidden owner UI mistaken for authorization | Enforce owner-only pricing, costs, discount approval, audit and sensitive exports server-side; only OWNER/OFFICE_EMPLOYEE. |
| Existing README/start-here conflict with confirmed 240 L rule | Correct documentation after approval; preserve historical transaction snapshots. D-019 negotiated prices remains distinct from confirmed D-027 fixed whole-order discounts. |
| Retry or duplicate submit | Durable idempotency, transaction/concurrency protections, no duplicate stock, payments or invoices; invalidate affected account/stock/dashboard queries. |

## Responsive and accessibility behavior

Desktop uses six-link petrol sidebar, warm off-white canvas, lime primary action, dark readable text, 16–18px body/labels and at least 44px targets. Mobile uses a labelled menu with the same six destinations; metrics stack, forms use one column and table records become labelled rows without dropping amounts or states. Full text actions, visible focus, associated validation and plain Somali loading/retry/success messages are required. Mockups establish the desktop direction; mobile behavior must be verified during implementation.

## Scope and validation

Changed deliverables for this checkpoint: this review document and before-design screenshots under docs/ui-v4/screenshots; four generated visual proposals. Application routes/endpoints/migrations: none changed for this checkpoint. Browser inspection was read-only apart from local login. No mutation tests, TypeScript checks or builds were run for this design-only checkpoint; earlier test results do not validate the proposed simplification. Following design approval, run invariant, role, retry, export, responsive and end-to-end workflow checks specified in the brief. No deployment is authorized.
