Fuel Wholesale Management System — Simple Somali UX Refactor

Purpose: Simplify the EXISTING mohamedkulane/fuel-managment-system for an older, nontechnical Somali-speaking owner without losing essential accounting, inventory, pricing, and delivery correctness.

This document is an implementation brief for Codex/Gemini. Do not treat it as proof code has been changed.

0. Repository facts to verify again before editing

Default branch inspected: master.

Existing frontend routes are in apps/web/src/app/.

Main navigation currently has 14 links in apps/web/src/components/app-shell.tsx, grouped under multiple headings; simplify to exactly six.

apps/web/src/app/orders/new/page.tsx currently asks users to select salesUnitId, fill numerous fields, creates a draft, and has a separate confirmation journey. The new ordinary workflow should be radically simpler.

apps/web/src/app/customers/[id]/page.tsx already has finance/statement integrations; preserve and repackage them.

apps/api/src/app.controller.ts already exposes separate order, payment, delivery-sheet, dispatch, reconcile, invoice and report APIs. Preserve core invariants, implement server-side orchestration if necessary, and do not try to fake a one-click workflow by firing unsafe independent browser mutations.

Stock receiving aliases already support /stock/receipts; older DB entities still have historic TankerReceipt names. Do NOT drop historical tables just to simplify labels.

AGENTS.md confirms 240 L per fuusto, receiving/selling in fuusto, manual driver handoff, OWNER and OFFICE_EMPLOYEE only, variable prices, fixed whole-order discount, optional costs.

README.md still contains obsolete 20L/booyad introductory text; reconcile documentation to confirmed business rules.

docs/09-decisions/decision-log.md still has decision questions that conflict with later confirmations; reconcile, but don't decide unresolved policies without owner input.

1. Target audience and non-negotiable UX objective

The daily operator is an older adult with limited technical familiarity. The interface should behave like a simple notebook for Shidaal soo galay → Macmiil → Dalab → Lacag la bixiyey / Deyn → Liiska gaarsiinta → Xisaab. No jargon such as dispatch, reconciliation, subledger, allocation, receipt posting, unit conversion version, idempotency, or invoice generation in ordinary user-facing controls. These remain internal concepts.

EXACTLY SIX TOP-LEVEL SIDEBAR LINKS

Guudmar — /.

Macaamiisha — /customers (customer accounts, debts, payments and printable statements INSIDE customer details).

Dalabyada — /orders (new order, daily delivery list/PDF, confirm actual delivered quantity INSIDE orders).

Kaydka Shidaalka — /stock (fuel receiving, current stock, price changes, receipt history INSIDE stock).

Warbixinnada — /reports (simple reports and Excel/PDF export).

Dejinta — /settings (owner/employee account, login settings, audit access owner-only in advanced section).

No separate sidebar items for invoices, payments, debts, pricing, deliveries, dispatches, receiving, audits, invoice histories, user management, or subledgers. Do not lose their functionality: embed in appropriate parent pages. Existing deep links should remain safe (redirect to relevant new parent/detail view where appropriate); do NOT drop security or historical records.

2. Four primary data-entry forms (maximum), plus tiny inline actions

Form 1 — Macmiil Cusub (Customer)

Visible inputs: Magaca macmiilka, Telefoonka, Goobta / Cinwaanka. All three essential as requested; decide required validation sensibly. Inline Kaydi action. No separate multi-step onboarding. Optional extra notes collapsed.

Customer list columns: Macmiil, Telefoon, Goobta, Deynta hadda, Eeg xisaabta. Search by name and phone. Details show one large figure Deynta hadda, alongside total bought (posted invoices), amount received, and a chronological list of orders and payments. Small tabs/sections: Xisaabta, Dalabyada, Lacag-bixinnada. Diiwaangeli lacag opens Form 4. Daabac xisaabta, PDF and optionally Excel. Distinguish net customer debt from any unapplied credit; never double count unbilled orders.

Form 2 — Shidaal Soo Geli (Stock receipt)

Visible: Nooca shidaalka [Naafto/Basiin], Tirada fuustooyinka [50, 40 etc.], Taariikh [today default]. Optional expandable Qiimaha lagu soo iibsaday (per fuusto or total), Iibiyaha, Faahfaahin. Display inline computed 50 Fuusto = 12,000 L using confirmed 240 L/Fuusto. Use existing receipt posting logic atomically. Frontend can guide one action Kaydi oo ku dar kaydka; server must prevent duplicate posting, preserve auditing and idempotency. Keep warehouse/in-transit accurate internally. Stock overview shows primary FUUSTO units for each fuel; liters secondary and optional, not five confusing KPIs.

Within same Stock page, show Qiimaha maanta for Naafto and Basiin with OWNER-only small Beddel qiimaha controls. Change per-fuusto selling rate (e.g., today $20, tomorrow $22); new confirmed orders use new current price; old order prices remain frozen. Price history tucked under a discreet Taariikhda isbeddelka expansion, not a new main page.

Form 3 — Dalab Cusub (Order + optional amount received)

Keep ordinary visible fields to: Macmiilka [searchable], Shidaalka [Naafto/Basiin], Tirada fuustooyinka, and the read-only live Qiimaha fuustadii from current price. Delivery destination/phone populate automatically from chosen customer; only show editable address if needed. Optional expandable: Lacag-dhimis ($) for the whole order, Hadda la bixiyey ($) for any cash received at order time, and a note. NO deposit field or deposit entity in the UI. NO unit selector. NO multi-step Draft→Confirm→Dispatch wizard for an ordinary user. Show a calm live summary:

Macmiil: Axmed
Shidaal: Naafto
5 fuusto × $100 = $500
Lacag-dhimis guud = $10
Wadarta dalabka = $490
Hadda la bixiyey = $100
Inta ka dhiman dalabka = $390  (estimate until accepted delivery)
[Kaydi dalabka]

Owner approves any discount. If OFFICE_EMPLOYEE asks for one, make the approval clear and easy inside the same Orders page (Sugaya oggolaanshaha milkiilaha), without adding an approval-management page. Never freeze a price silently without a review, particularly if it changed during entry.

Payment accounting when recorded before delivery: It is a standard customer payment, not a separate "deposit" feature. Because formal invoices are based on actual accepted delivery, a payment recorded when the order is placed must post safely as customer credit/unallocated payment until the accepted-delivery invoice exists, then be reconciled/allocated according to an explicitly approved policy. Do not falsely post an invoice or recognize finalized debt at order creation. Show Inta ka dhiman dalabka as an order estimate until delivery is confirmed. Customer ledger must accurately distinguish invoices, applied payments, unapplied credit, and final net position. If payment allocation policy is unresolved, flag that specific decision; do not silently invent FIFO.

Form 4 — Lacag Diiwaangeli (Collect a payment)

From Customer detail, button Lacag Qaado opens small dialog: Lacagta la bixiyey ($) and optional Habka lacagta and Tixraaca. Customer already selected. No complicated invoice allocation matrix shown to this user. After successful posting, update net customer position and ledger immediately without manual refresh. Safely reuse/extend existing payment service, ensure amounts are not duplicated on retries. Any allocation strategy must be approved; do not conceal the distinction between outstanding invoice totals and unapplied credits in accounting data.

Small secondary actions (not extra standalone complex forms)

Beddel qiimaha, Xaqiiji shidaalka la geeyey (actual quantity), Daabac liiska maanta, Soo dejiso PDF, Daabac xisaabta, PDF/Excel warbixin. Use simple inline controls or very small dialogs; the user should not fill technical fields like returned liters or commercial disposition. When delivery is partially accepted, backend must still account for remaining fuel as returned or still in transit. Present this as a plain-language choice only when necessary, and don't assume physical return.

3. Orders page contains all manual delivery operations

Orders list: Macmiil, Shidaal, Fuusto, Wadarta, La bixiyey, Haray (estimate/actual labelled), Xaaladda, and one action Eeg or La geeyey. Top actions Dalab Cusub and Daabac Dalabyada Maanta. Include date filter and searchable list, not many tables and statuses.

Daabac Dalabyada Maanta must build a nonfinancial manifest listing only Customer, Phone, Location, Fuel, Fuusto, Notes. Two options Daabac and PDF. NO prices, balances, discounts, payments, profit (including PDF hidden fields/metadata). The delivery worker has no system login or role.

When owner/office staff later hears what customer actually received, show Tirada uu qaatay defaulting to ordered/dispatched units. E.g., 20 ordered but 18 accepted. Show 2 fuusto ayaa haray — Ma bakhaarka ayay ku soo noqdeen mise wali waa jidka? (if required by existing reconciliation invariant). Behind the scenes: create/post dispatch, reconcile accepted and returned/in-transit with transactional safety, generate invoice from accepted units, and correctly apply the fixed whole-order discount without duplication; no extra end-user pages. If this cannot happen safely in one backend transaction, implement a resumable idempotent workflow with clear human status rather than hiding incomplete states.

4. Dashboard: what the owner actually needs

Keep only: Kaydka Naaftada (Fuusto), Kaydka Basiinka (Fuusto), Lacagta maanta la qabtay, Deynta macaamiisha hadda. One short Dalabyada maanta table and clear actions Dalab Cusub, Macmiil Cusub, Shidaal Soo Geli. No top-5 charts, KPI walls, multiple trend sections, warehouse/in-transit technical taxonomy or profit approximations. Give an accessible alert for orders not yet delivered. Owner-only costs must never show to employee.

5. Reports: simple and useful

One report page with four report selectors: Macaamiisha iyo deymaha, Iibka, Lacagihii la qabtay, Kaydka Shidaalka. Filters Laga bilaabo, Ilaa, optionally customer. Each report supports Daabac, PDF, Excel; server computes authoritative totals, all filtered records not just current page. Customer statement also prints from customer detail. Move audit log behind Owner-only Settings advanced disclosure; do not compromise audit retention/security.

6. Somali terminology + aging-friendly design

Use short, natural Somali, not literal or exotic machine-sounding translations. Dalab, Kayd, Deyn, Lacag la bixiyey, Lacagta haray, Shidaal soo geli, Gaarsiin, Daabac, Xisaabta macmiilka, Qiimaha maanta. Avoid visibly exposing invoice, dispatch, reconciliation, allocation, subledger, conversion, idempotency, snapshot, posting in daily workflow. Internal code identifiers and audit records can stay English.

Palette: #003333 primary deep teal, #99CC33 accent lime, warm off-white surface, large readable dark text. Body >= 16–18 px, clear page titles ~24–30 px, form labels >=16 px, touch targets >=44px, generous spacing, strong contrast, explicit text buttons (not icon-only), no low-contrast gray-on-gray labels. Clear confirmation for irreversible actions. Loading/error/success states are plain Somali. Minimize scrolling, avoid excessive modals, nested tabs, graphs, duplicate counters and unnecessary columns. Mobile responsive but desktop-first for office usage. Consider accessibility and keyboard navigation.

7. Change safety: keep robust backend, simplify UX

Do NOT remove database/ledger models because their UI links disappear. Do NOT blindly delete deep pages or existing APIs. Keep secured links for documents, historical invoices, payment reversals, audit trails, and exact inventory operations; they can be accessed from contextual details/Settings as needed.

Refactor UI routes safely. Old bookmarks should redirect to new contextual views when appropriate, or serve secure detail views with a visible back action. Never redirect an unauthorized employee into sensitive information. Keep OWNER and OFFICE_EMPLOYEE only. Preserve immutable price snapshots, amount precision, idempotency, invoice-from-accepted-quantity, ledger and financial reversals. Do not show outdated "booyad" language or 20L assumptions. Purchase cost optional and owner-only. Profit not fabricated if cost missing or costing policy unapproved.

Existing documentation conflicts: README.md still mentions booyad and 20L; update to 240L fuusto and no tanker in UI. Review D-019 / D-027 overlap and approved/unspecified partial-delivery discount allocation policy. Do not change historical records. Ensure latest AGENTS.md matches confirmed business requirements and UX standard.

8. Implementation sequence — stop at design checkpoint

Audit current routes, nav, forms, permission flows, and API transactions. Produce concise existing→new route table and risk inventory before editing.

Create proposed six-link shell plus representative wireframe/page screenshots for Guudmar, Macaamiisha, Dalabyada, Kaydka; user must approve look before full rollout.

Build shared big readable accessible components and Somali terminology dictionary.

Implement customer + stock flows.

Implement one-page order + optional payment orchestration and manual delivery actions, including existing invoice and reconciliation accounting safeguards.

Consolidate customer ledger/payment UX and reporting.

Hide/retire/redirect redundant routes; keep secure records accessible contextually.

Verify end-to-end in browser as OWNER and OFFICE_EMPLOYEE, then unit/integration checks, PDF/Excel outputs, responsive and large text accessibility checks. Do not deploy.

9. Required tests

1 fuusto = 240L; receive 50 fuusto Naafto -> 12,000L; Petrol 40 + 60 fuusto -> 100 fuusto.

Pricing today $20 vs tomorrow $22; prior order snapshot unchanged, even if customer has debt.

Order 5 fuusto at $100 = $500, fixed whole-order discount $10, final $490.

At order time $100 paid (NOT a deposit), no double charging; eventual delivered invoice / $390 net owed after full accepted delivery; default no payment yields full balance after accepted delivery.

Order 20 fuusto; customer accepts 18. Only 18 billable; returned vs in-transit difference accounted for, discount not double-applied on split invoices.

A customer with existing debt can place a new order and pay incrementally; ledger and printable statement balances always reconcile, without forcing invoice-allocation UI on ordinary operator.

Delivery manifest/PDF has zero financial data even to owner; NO driver accounts.

Both roles restricted correctly; owner-only purchase costs, pricing and approval, audit protected.

All four basic entry forms work, nav exactly 6 top-level links, full Somali messages, keyboard focus, readable large text, no browser refresh after mutations.

Prevent double stock increments, duplicate order confirmations, duplicate payments, and double invoices under retries.

Docs/tests reflect changed workflow, PDF/Excel export correctness, database backup unchanged.

10. Acceptance criteria

A nontechnical older user can add a customer, add fuel, change current fuel price, create an order, record money received, print today's delivery sheet, confirm actual delivered quantity, and print customer account with no technical accounting jargon, never having to navigate to another top-level section unnecessarily.

Sidebar has EXACTLY 6 links; four principal forms; each daily workflow no more than 1–2 simple screens (excluding optional confirmation).

Security, precision, inventory, finance, audit and historical records preserved.

Browser screenshots and human walkthrough verify clarity; all executable tests honestly reported.