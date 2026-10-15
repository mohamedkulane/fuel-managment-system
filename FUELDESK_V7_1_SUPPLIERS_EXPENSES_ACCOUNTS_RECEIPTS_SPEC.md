# FuelDesk V7.1 — Supplier Debt, Expenses, Financial Accounts & Payment Receipts

**Status:** Approved requirement update / implementation specification. NOT implemented or verified by this document.
**Precedence:** V7.1 is the consolidated successor to V7. It retains all V7 requirements, adds confirmed Expense Option A and customer Payment Receipts, and overrides V7 only where explicitly clarified. Preserve V6.1 order-based finance behavior.
**Confirmed decisions in V7.1:** (1) Expenses paid from a tracked account automatically record one linked Money Out movement in FuelDesk; (2) every posted customer Money In payment has an accessible, printable monochrome **Payment Receipt**; (3) an Order Invoice and a Payment Receipt are different documents.
**Repository:** `mohamedkulane/fuel-managment-system`
**Read first:** `AGENTS.md`, current V6.1 business documentation, Prisma models, stock receiving workflow, simple order/payment workflows, financial subledger, report exporter, and existing tests.

## 0. Intent and scope

FuelDesk is a small, single-business fuel wholesaler with **two fuels (Naafto / Basiin)** and **1 fuusto = 240 liters**. The owner receives fuel in whole-number fuusto, sells by fuusto, sometimes purchases fuel from suppliers on credit or pays only part of the purchase price, pays real business expenses (including a driver who delivers outside the system), and receives customer payments into distinct cash/mobile-money/bank accounts. This change must make supplier debts, operational expenses, and account-by-account money flows visible without turning the app into complicated accounting software.

Add TWO sidebar routes: **Kharashaadka (Expenses)** and **Accounts**. Keep **Suppliers & Debt as an embedded tab of Kaydka (Stock)**, not as another sidebar route. Sidebar now has **8** items: Guudmar, Macaamiisha, Dalabyada, Kaydka, Kharashaadka, Accounts, Warbixinnada, Dejinta. Do not add an employee/driver login or delivery role. Do not restore invoices, dispatches, payments, or suppliers as standalone sidebar sections. Existing order-based customer accounts, automatic FIFO debt payments, owner-only reversals, order PDF, dated delivery PDFs, and other business features remain.

Before implementation, perform a focused gap audit and document how currently posted receipts, existing customer payments, and account history will be migrated safely. Phase-gate work; never invent balances.

## 1. Supplier register & stock purchases

### Suppliers
A supplier is a **separate entity from a customer**. Minimum fields: supplier name (required), optional phone, optional location and notes; `ACTIVE` state. Show supplier name, total purchases where costs known, total paid, **outstanding debt**, and an accessible purchase/payment history. Store supplier identity and credit balances with tenant/business scope as appropriate (single business).

### Receive stock
The simple Receive Stock action must still be fast: choose Naafto/Basiin, integer count of fuusto, receiving date, optionally select a supplier, optionally enter cost **per fuusto OR total cost**, and optionally record `Paid Now` and which financial account paid it. Calculate liters automatically at 240 each. For cash-and-credit tracked purchases, total cost and supplier are **required** to calculate debt; for purely quantitative receipt (no cost captured), cost remains optional and supplier debt is **Unknown / Not tracked**, NEVER $0 or a fabricated payable.

Display calculated purchase subtotal, `Paid Now`, and `Supplier Remaining` only if cost is present. `0 <= Paid Now <= Purchase Total` and amounts are decimal-safe USD; quantities are positive integers only. The receipt posts stock independently of whether the owner has paid the supplier. Example: 50 fuusto × $80 = $4,000; paid now $1,500 from EVC Plus; remaining supplier debt $2,500. Purchase payments affect cash/account balances but **not inventory quantities**. Always snapshot fuel type, fuusto quantity, conversion 240L, purchase cost, supplier, purchase time and posting actor on the receipt.

If the same supplier later delivers another batch, add a **new purchase transaction** and increase payable independently; do not overwrite first receipt. Credit account belongs to supplier, not the customer Accounts Receivable ledger.

### Pay supplier debt
Within Stock > Suppliers & Debt, show supplier profile/purchases and a **Pay Supplier** form: selected supplier, current payable, amount, payment date, paying financial account and optional reference/notes. Support partial payments and repeat purchases while old debts exist. Default to FIFO against oldest outstanding supplier purchases, transactionally. Reject paying more than outstanding payable, invalid/negative amounts, and paying from a financial account without sufficient tracked balance **when the business enforces nonnegative balances**. Implement owner-only reversal/correction, with mandatory reason, append-only audit entries and linked compensating movements. Do not delete a posted purchase or payment. One reversed payment cannot be reversed twice even with concurrent clicks.

Example: $4,000 purchase, $1,500 paid now, $2,500 owed. A later $1,000 supplier payment reduces owed to $1,500. A new $2,000 credit purchase makes total owed $3,500. All payments must be traceable to the original supplier and optionally allocations to purchases.

## 2. Expenses page

Standalone sidebar route `/expenses` titled **Kharashaadka (Expenses)**. Record **business expenses**, with a clean screen and an Add Expense modal. Minimum fields: short description, category, positive amount, payment date, **Paid From** (select configured account; explicit Owner-only Outside/Not Tracked exception if needed), optional notes/reference. Categories initially include `Delivery / Gaarsiin`, `Fuel transport`, `Rent`, `Utilities`, `Salary / Wages`, `Maintenance`, `Other`; use editable category labels or simple configuration rather than hardcoded provider specific logic. Driver example: on a day delivering orders the owner pays **$40**; select `Gaarsiin`, amount `$40`, date, paying account `Cash` or `EVC Plus`. Do not create a driver user account, payroll engine, automatic daily recurring $40 charge, or link to each order unless requested later. Store optional order/date reference if it genuinely helps; expense is entered manually.

CONFIRMED (Option A): Every **paid** expense entered from a configured tracked financial account must create **exactly one** linked `Money Out` entry and decrease that account's **FuelDesk book balance** in the **same database transaction**. The expense must also appear once in the Expenses ledger/report. This does **not** charge or withdraw funds from the actual EVC Plus, Somnet, cash drawer or bank provider; no external API integration is implied. If the owner genuinely paid it from outside all tracked accounts, allow a clearly marked, Owner-only `Outside / Not Tracked` exception that records the expense **without** changing any tracked account balance and flags it for reconciliation. Never silently infer a paying account or leave a paid expense marked as paid from a tracked account without the corresponding movement. Show period total, category summary, spending by account, and simple list with date, description, category, amount, source account. Support date filters, PDF/Excel export through existing report infrastructure when useful, and owner-only reversal/correction preserving audit and posting one matching *opposite* account movement. Reversal must not delete the original expense or make the same Money Out twice. An untracked Outside expense has no account debit or automatic debit reversal. Refunding a payment is a **separate real-world event**; accounting reversal alone does not claim funds were returned to a wallet. An expense is **not supplier debt**, and is **not a customer payment**. Delivery manifests must never contain costs or expenses.

Gross profit (revenue minus cost of fuel sold) and net profit (gross profit minus applicable operating expenses) are different. Do not calculate or promise reliable gross/net profit while stock costing policy is unapproved or purchase costs missing. Operating expense totals can be shown separately even when profit is unavailable. Posting a fuel-stock purchase is not automatically an operating expense.

## 3. Financial Accounts page

Standalone sidebar route `/accounts`, titled **Accounts**, for money kept in a specific collection/payment channel: e.g. **EVC Plus (phone X)**, **Somnet (phone Y)**, **Cash on Hand**, **Bank**, and other configurable accounts. One provider can have multiple distinct account numbers, and each can be enabled/disabled. Store account label, provider/type, masked account number or phone (optional), currency (USD initially), opening balance with `asOf` date entered by owner, status and owner-visible notes. Treat a payment **method** (EVC Plus, cash, etc.) as distinct from the actual **financial account** (EVC Plus business number 1); accounts cannot be deduced reliably from generic payment method alone.

Every NEW incoming customer payment, outgoing supplier payment, paid expense and internal transfer must choose/link the actual financial account; owner can configure which accounts staff may select. The sole paid-expense exception is an explicit Owner-only `Outside / Not Tracked` source, which is not a fictitious wallet. Do not post new tracked account movements until the relevant account is configured; retain historical records as unassigned if reliable mapping is unavailable. Entries should be **atomic with their source business transactions** and never counted twice. Payment Receipt PDF generation is **read-only / side-effect-free**: opening, printing or downloading it must not insert a second Payment or Money In movement. Record for each account: opening balance, incoming payments, outgoing payments/expenses, transfers in/out, owner-approved corrections, **current recorded balance**. Include transaction history with `date, reference, source (customer / supplier / expense / transfer), money in, money out, running balance` and date filters. Show a compact **Receipt** action on each valid posted incoming **customer payment** row, linking to the payment's printable Payment Receipt PDF. Do **not** create a new customer invoice from a payment. Expense / supplier rows may use a simple `View` action but must not masquerade as customer payment receipts. Example: EVC Plus received $500 from customers, Somnet received $200; their **receipts by account** are $500/$200. If accounts have opening balances, expenses, supplier payments or transfers, their final balances differ; don't label receipts as balance.

Support `Transfer` between owner financial accounts as a single double-sided, atomic event (EVC Plus → Cash or Cash → Bank); **transfer is not customer revenue, not supplier payment and not expense**. No external EVC/Somnet/bank API integration is implied; balances are **manually recorded book balances** that need reconciliation with provider/bank statements. Show a warning on opening balance/configuration and do not make claims about live wallet balances.

Historical payments without a known account mapping must be classified as **Unassigned / Needs mapping** or migrated only where evidence establishes the account; NEVER assign all previous `EVC_PLUS` payments to one guessed EVC phone number or assume zero opening balances. Create an owner-only historical mapping/reconciliation workflow, with preserved audit.


## 3A. Confirmed: Incoming customer payments must have a Payment Receipt

**Business clarification:** The owner calls this a simple proof of an EVC Plus/Somnet payment. The correct document is a **Payment Receipt (Rasiidhka Lacagta)**, not a *second sales invoice*. Preserve the existing Order Invoice separately for fuel quantity, fixed discount, price and order total. A Payment Receipt proves **one particular payment** that has actually been recorded.

### What creates the receipt

- Every successfully posted **customer Money In** (regular debt `Pay` **and** `Paid Now` attached to an order) is associated with a unique stable payment reference/receipt number. Assign an actual configured receiving `financialAccountId` such as `EVC Plus · 61••••123` or `Somnet · 62••••456`. Store the method and optional provider transaction reference as distinct fields; a method alone must not guess the account.
- **Exactly one** payment posting → **exactly one** account `Money In` movement → **one** accessible Payment Receipt for that payment, with the existing idempotency and serializable/concurrency protections. Printing/opening the receipt is read-only. Do not create an additional invoice, post additional revenue, or increment Money In again when receipt is viewed.
- In **Accounts > selected account > Money In history**, show Date, Customer, Amount, Status and one compact **Receipt** action. In **Customers > Payments** show the same Receipt action for the same payment; both point to the *same* immutable payment reference/authoritative receipt generator. Keep only one `Receipt` button per transaction row, not duplicate Print/Download buttons. Browser PDF viewer handles print/download.
- An account entry that is a **transfer in**, opening balance, owner adjustment or supplier refund must **not** be falsely labeled a customer payment receipt. Show Source and a suitable `View` action or traceable evidence according to its type.

### Approved Receipt PDF layout (monochrome)

Use white paper, black/dark-gray text, thin gray lines, quiet typography, company logo/name if configured, A4, correct wrapping, no big green color blocks or giant headers. Use the **actual** company profile; omit unavailable optional fields. Sections, all compact:

1. Header: company logo/name, phone/address if configured; `PAYMENT RECEIPT`, unique receipt/reference, business date/time.
2. Customer: name, phone (if recorded).
3. Prominent `Paid Amount: $X.XX`; `Account: EVC Plus — masked number` (or Somnet, Cash, Bank), `Method`, provider transaction reference if available. Show sensitive financial-account identifiers **masked** and only information the user is authorized to reveal.
4. If **old customer debt payment**: show `Debt Before` and `Debt Remaining` **as of that payment**, only if server data and chronological ordering make those figures verifiable. If not dependable, omit these numbers rather than print invented or current-live balances on an old receipt. For FIFO applied to several older orders, optional compact list of order references may be included if helpful.
5. If **Paid Now** on an **undelivered** order: show `Order: ORD-...`, `Order Total`, `Paid This Time`, `Order Remaining (Pending Delivery)`. **Do not** call the undelivered remainder a posted customer debt; do not call this a deposit/unapplied amount. Once the delivery is accepted, debt/settlement must be computed by the actual accepted quantity and order allocation. Avoid silently regenerating a historically misleading new debt snapshot for an earlier receipt.
6. Minimal 1–2 line note, unobtrusive footer; print date is optional and separate from actual payment date. No unnecessary payment-information box or repeated summary.

Use consistent 2-decimal USD display while maintaining exact Decimal internal math. The receipt must show the payment **actually made** (e.g. $200, not the full $500 order/debt). Financial amounts should not be taken from UI labels or independently recomputed with JavaScript floats.

### Reversals & historical payments

- Reversal remains Owner-only with a required reason and concurrency-safe one-time correction. If a payment is reversed: customer debt/order allocation is restored appropriately; its original account Money In receives exactly one corresponding **Money Out correction**; totals exclude the reversed amount from net receipts; trace both events.
- Previously issued receipt references must remain traceable. If a reversed payment receipt is opened again, label it prominently `REVERSED` / `VOID` with reversal date/reference and never present it as a valid, outstanding paid receipt. Do not delete/overwrite historical Payment, reversal, allocation or account movement rows.
- For historical posted payments with **unknown** actual receiving account: preserve the payment; show `Account: Not assigned / Needs review` only where needed, and **do not** claim that EVC Plus or Somnet received that money. An Owner-only mapping flow may associate a payment with an account only when evidence exists; require idempotent, audited mapping so it adds one historical account movement, not two. Historical Payment Receipts are available using reliable existing data and must not fabricate provider account numbers.

### Example, with financial consistency

Customer Ahmed owes `$500` of delivered old debt. He pays `$200` to **EVC Plus account A**. Record one real `Payment($200)`; allocate it FIFO to eligible delivered debt; account A records `Money In $200`; debt becomes `$300`; one Payment Receipt for `$200` linked to that payment. When Owner opens the receipt from Accounts or Customers, no new money movements or invoices are created. If payment is later reversed, the account book balance decreases by `$200` and the eligible debt is restored by `$200` exactly once.

## 3B. Confirmed: Expenses affect the selected tracked account

When Owner records a paid `$40` Delivery expense with `Paid From: EVC Plus account A`, FuelDesk posts both `BusinessExpense $40` and a linked **Money Out $40** inside **one transaction**. The expense is shown once in expense reports, the account entry appears once in Accounts, and `accountBalanceAfter = accountBalanceBefore − $40`. It must **not** automatically create a customer payment or an additional supplier transaction.

`Outside / Not Tracked` is only for a genuine payment outside managed accounts: record the expense but **no** managed-account movement, with an explicit indicator and Owner access; do not invent a wallet or claim balances remain reconciled if out-of-system funds were used. The owner can later review which source actually paid it.

Expense reversals must create a traceable opposite movement to restore book balance **exactly once**. Preserve original expense details and audit history. If the outside-world expense was refunded or wallet payment canceled, that event may require its own separate record; a book reversal alone must not claim the telecom or bank refunded cash.

### Reconciliation rules shared by both

- `Money In by account` means **net posted customer cash received** into that particular account, not recognized sales revenue and not automatically equivalent to account balance. Opening balances and transfers in are not customer receipts. Display gross/reversed/net clearly without double-counting.
- `Money Out by account` includes distinct categories supplier payments, paid expenses, transfers out and corrections, each recorded at most once with a unique source/idempotency constraint.
- Account ledger movement must link to **exactly one** source payment/expense/purchase/transfer/correction; unique indexes guard against double posting. Do not use a single generic transaction for both a real payment and a PDF export.
- Keep `ExpenseTotal` and `SupplierPurchaseCost` separate; stock purchase may be inventory asset/cost of goods, not the same as $40 operating expense. Do not compute net profit from incomplete purchase costs.

## 4. Payment integrity, supplier balance, receipts and permissions

Use transactional, Decimal-safe postings and an auditable financial movement ledger; do not use JS floating point to post USD values. Proposed relational concepts (adjust after reviewing schema): `Supplier`, `SupplierPurchase` (or extend existing TankerReceipt without destructive rename), `SupplierPayment`, `SupplierPaymentAllocation`, `BusinessExpense`, `FinancialAccount`, `FinancialAccountMovement`, `AccountTransfer`, and optional reconciliation/mapping records. Reuse existing `Payment` and invoice-derived customer Accounts Receivable ledgers; add nullable `financialAccountId` to incoming payment records via backward-compatible migration, and link `SupplierPayment` / `BusinessExpense` to accounts. Reuse existing customer payment receipt PDF functionality if present; it is preferable to extending it over creating a second receipt/payment financial model.

Keep `OWNER` and `OFFICE_EMPLOYEE` roles only. OWNER manages financial accounts and opening balances, supplier cost/debt, supplier payments, account transfers, expenses and reversals, and sees financial account balances. OFFICE_EMPLOYEE may record regular customer payments, select an authorized receiving account and perform permitted stock/order actions, but must not receive extra visibility into supplier purchase prices, supplier payables, profit or all account balances absent explicit owner approval. Enforce in API DTOs and authorization, not CSS/UI alone.

Idempotency on all money-posting APIs, transactional balance checks, no duplicate account movements, safe reversal under double clicks/concurrent requests, audit actor/time/reason, no hard delete of posted records. Ensure source records and corresponding account movements agree after a reversal. Real receipts/postings and expenses require real dates in Africa/Mogadishu; no UTC technical strings on user screens.

## 5. Simple UX and page structure

| Sidebar | Visible workflows |
| --- | --- |
| Guudmar (Dashboard) | Sales, collections, warehouse stock, supplier debt, expenses, simple charts |
| Macaamiisha (Customers) | Customer profiles, debts, payments, statements |
| Dalabyada (Orders) | Simple order entry, order PDF, selected-date delivery list, accepted delivery |
| Kaydka (Stock) | Receive Stock, current fuel prices, stock history, **Suppliers & Debt** tab |
| **Kharashaadka (Expenses)** | Add Expense, expense history, category totals |
| **Accounts** | Financial accounts, receipts by channel, recorded balance, transfers, history |
| Warbixinnada (Reports) | Existing reports plus supplier debt, business expenses, account movements |
| Dejinta (Settings) | Business profile, user management, limited settings |

Keep the approved teal/lime **app** UI but **all** financial PDFs (Order Invoice, Customer Statement, Payment Receipt, Delivery List) monochrome as previously approved. Labels short, mixed Somali/English: `Supplier`, `Debt`, `Paid`, `Remaining`, `Pay Supplier`, `Add Expense`, `Paid From`, `Account`, `Money In`, `Money Out`, `Transfer`, `Receipt`. Buttons `Save`, `Pay`, `Edit`, `View`, `Statement`. Do not introduce confusing `unapplied/allocated` UI terms. Keep forms as few and as short as practical; 3 new small forms (`Add Supplier`, `Pay Supplier`, `Add Expense`) plus a simple `Add Account` and `Transfer` action when required. Responsive at 320/360/390/430/768/1024/1440 with no horizontal page overflow. Global toasts after confirmed server success only and query-cache refresh without reload. No driver portal.

## 6. Core acceptance scenarios

A. Receiving 50 Fuusto Naafto creates +12,000L stock and $4,000 supplier purchase; paying $1,500 from EVC Plus creates $2,500 supplier payable, -$1,500 in EVC account, **stock remains 50 fuusto**.

B. Paying supplier $1,000 later reduces payable $2,500 → $1,500 and reduces the chosen account $1,000, with FIFO allocation.

C. A new $2,000 supplier credit purchase increases total supplier debt to $3,500; stock increases with units, never with payment amount.

D. A stock receipt without cost posts inventory but has **unknown purchase value**, no fictional $0 payable/profit.

E. Owner records $40 delivery expense from Cash. Expense ledger +$40; Cash financial account movement -$40. Driver has no login and gets only privacy-safe printed delivery list.

F. Customer payment $500 to EVC Plus and $200 to Somnet produces respective received totals **and two distinct receipts, each for its original payment**. Receipt amounts remain $500/$200 regardless of later account expenses. On opening a receipt, no new payment, ledger, invoice or account movement is created. Report distinguishes incoming amounts from account balances and from sales/invoices. If $50 EVC expense occurs, receipts stay $500; recorded balance is adjusted by -$50 alongside opening balance/other events.

G. EVC → Cash transfer $100 reduces EVC and increases Cash exactly once; not revenue or expense.

H. Reversed expense/supplier payment/customer payment restores exactly the relevant payable/receivable and cash-account book balance; two simultaneous requests cannot double-reverse. Reversed customer Payment Receipt is clearly **REVERSED / VOID** if reopened, not silently displayed as a valid paid receipt.

I. Historical payments not reliably attributable to an account remain unmapped, with reconciliation prompt; totals must not claim they belong to a guessed wallet.

J. Owner-only account amounts and supplier costs are redacted from OFFICE_EMPLOYEE API responses; server enforcement tested.

K. Preserve order discounts, FIFO collection against delivered customer debts, per-order upfront payments, dynamic historical selling prices, partial deliveries, **customer Order Invoice PDFs separate from Payment Receipts**, selected-date delivery PDFs, stock accuracy.

L. All new pages accessible on mobile and desktop, real data, no duplicate buttons or standalone invoices/driver menus.

### Additional V7.1 receipt/expense acceptance tests

M. Delivery `$40` expense paid from EVC account posts one expense and **one** `Money Out $40`; two identical `Save` retries cannot double-debit. Expense category report includes $40 once. No EVC API call.

N. Delivery `$40` expense explicitly `Outside / Not Tracked` posts one expense and **zero** movements to tracked EVC/Somnet/Cash/Bank accounts; Owner sees `Not Tracked`, regular staff cannot falsely pick it without permission.

O. Old customer debt `$500`; Pay `$200` to EVC account A => customer debt `$300`, `Money In A +$200`, exactly one receipt `$200`, correct masked account and customer. Open the PDF three times: no database changes. Same receipt accessible from Accounts and Customers.

P. New order `$500`, Paid Now `$100` via Somnet before delivery: Somnet `Money In +$100`; receipt says **Paid Now** and `Order Remaining (Pending Delivery) $400`, NOT `Customer Debt $400`; customer's old debt remains unchanged. Upon accepted delivery, payment is assigned only to that order, not counted twice.

Q. Payment reversal after posting Money In creates one linked reversal account movement, customer debt/order balances restore once; original receipt displays `REVERSED`; repeated/concurrent reverse requests cannot create two correction movements or two reversal entries. The receipt PDF must not claim successful active payment after reversal.

R. Account A Money In `$500` and Somnet Money In `$200`; EVC expense `$40` => **net customer collections EVC $500**, **EVC book balance changes +$460 net of expense** (before opening balance and other movements), Somnet collections `$200`. Transfer Money In, opening balance and reversed customer payments do not inflate customer collection totals.

S. Existing historical payment with method `EVC_PLUS` but unknown business number remains unassigned; receipt does not invent number or increase a guessed account balance. Owner evidence-backed mapping creates exactly one audited entry.

T. One receipt PDF rendered with long company/customer name, with and without optional fields; monochrome A4; correct unique reference, date, currency, no overflow; frontend `Receipt` action works on 320px through desktop. OWNER/OFFICE_EMPLOYEE access rules match the existing customer-payment permissions without exposing owner-only supplier costs/account balance administration.

## 7. Implementation sequence and exit criteria

1. Read/audit current repo and data; identify migrations and resolve business questions below. Do not modify database blindly.
2. Supplier master + purchase receivables/payables model and Stock receiving changes, migration, unit/integration tests.
3. Financial accounts and opening balances; link new customer/supplier/expense payments to real accounts and migrate historical records safely.
4. Expenses (Option A account deduction) + account transfers + reversal protections; introduce shared payment/account atomic movement and linked correction semantics.
5. Concise responsive UI (8 sidebar items), reports, **Payment Receipt PDFs accessible in Accounts and Customers**, PDF/Excel, permission checks; visually compare with monochrome references.
6. End-to-end tests: typecheck, schema validate, test:unit, database integration tests (including V7.1 cases M–T), frontend build, rendered PDF checks, screenshots at mobile widths; test backups/restore where practical.

Report exact test commands and outcomes. This document is a change request, not proof of completion. Do not deploy production.

### Owner decisions to confirm before financial production use

- Starting amount and effective date for EACH EVC Plus / Somnet / Cash / Bank financial account. Do not invent these.
- Which financial accounts exist, their names/numbers, and which account receives each payment (especially old data). Mask identifiers where appropriate.
- Whether a supplier purchase without stated cost is simply inventory-only (recommended) rather than booked as supplier debt.
- Is the delivery worker always paid **$40 for the entire day** (manual expense) rather than per customer/order? The request suggests per day; don't auto-generate payments.
- Whether expense and supplier payments must be blocked for insufficient recorded account balance, or whether overdraft/negative book balances are permitted. Do not silently impose one policy. **Option A automatic internal deduction itself is CONFIRMED** and not an open decision.
- Currency and any account-specific charges or fees. Assume current USD-only records but don't invent exchange rates.
- If an expense is actually paid from outside recorded accounts, use the explicit Owner-only `Outside / Not Tracked` exception; decide whether a later mapping/correction workflow should move it into a tracked account. Never debit both sources.
- Payment Receipt is CONFIRMED for incoming customer payments; exact legal receipt numbering/prefix and whether business signature is shown may be configured later. Do not invent company identity.
