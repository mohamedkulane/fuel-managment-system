# Screen-by-Screen Specification and Access

| Route | Core views and actions | Roles |
|---|---|---|
| `/login` | Email/password, generic invalid credentials, session expiry | Public |
| `/dashboard` | Owner: stock per fuel, collections, outstanding, open orders, discrepancy, bar charts; Employee: tasks/collections/stock if allowed, **no cost/profit** | Both, role variant |
| `/customers` | Paginated searchable list, active/held, phone, location, owed balance; add/edit dialog | Both |
| `/customers/:id` | Contact/address, orders, deliveries, invoices, payments, chronological statement, print/export statement | Both |
| `/orders` | Search, status/date/customer filters, create, preview locked unit price, draft vs confirmed badge, scheduled vs accepted quantity | Both |
| `/orders/new` | Customer picker, address, fuel lines, fuusto size, requested count, delivery date, notes, submit draft/confirm | Both |
| `/orders/:id` | Lifecycle timeline, immutable confirmed price snapshot, deliveries, invoices, cancellation/amendment actions with permissions | Both |
| `/deliveries` | Date selector, eligible orders, selection, generate sheet; today's pending/printed/dispatched/reconciled | Both |
| `/deliveries/:sheetId` | Non-financial **Print / Download PDF**, line preview, no cost/debt, record dispatch separately | Both |
| `/dispatches/:id/reconcile` | Per-line ordered, dispatched, accepted, returned, still transit, future backorder/cancel choice, notes/reason, final confirmation | Both |
| `/stock` | Diesel/petrol warehouse vs transit vs available; tanker receipt history; movement ledger; owner only cost/valuation tab | Both, cost owner |
| `/stock/receive` | Truck reference/supplier/date, actual measured liters per fuel, expected optional, draft/posted; cost fields owner only | Both if receive permitted |
| `/pricing` | Current fuel/unit prices, versions and effective dates; edit restricted | View both, edit OWNER |
| `/payments` | Collection history, record receipt modal, allocation panel, receipt print, filters cashier/date/method | Both |
| `/invoices` | Posted invoice list, overdue aging, invoice detail and remaining due; invoices created only after accepted delivery | Both |
| `/reports` | Report selector, filter panel, PDF/XLSX exports, show active filters/totals, hide unavailable owner-only reports | Both, scoped |
| `/settings` | Fuusto sizes and conversion versions, prices/policy, payment methods, users, company info | OWNER |
| `/audit` | Filter activity: stock/price/payment/security with before/after redaction | OWNER |

## Critical screen: Delivery sheet
Header: delivery date, sheet number, selected order count, buttons `Print Delivery List`, `Download PDF`. Table columns: `#`, `Order`, `Customer`, `Phone`, `Address`, `Fuel`, `Scheduled Fuusto`, `Instructions`, optionally blank `Accepted`, `Signature`. **Never display price, purchase cost, amount paid, debt, revenue or profit here**. Confirmation entry remains an authenticated office-only action on separate internal screen.

## Critical screen: Customer account
Overview card: customer name, phone(s), delivery addresses, account state, **posted** outstanding and unapplied credit separately. Tabs `Orders`, `Deliveries`, `Invoices`, `Payments`, `Statement`; chronological timeline is not reconstructed from current fuel price. CSV not required; PDF/XLSX statement export supported.

## Critical screen: Order reconciliation
Before physical dispatch: planned 20, warehouse stock unchanged by printing. After physical dispatch: 20 in transit. After customer accepts 18: accepted 18, 2 unresolved until reported returned; separate buttons `Record Physical Return` and `Mark Future Backorder/Cancel Remainder`. Server computes invoice-eligible accepted lines, displays 18 * historical $120 = $2,160 in **authenticated office internal view only**, never in external manifest.

## Screen states and errors
Every list has loading, empty/no-results, server error/retry, no-access and pagination. On `INSUFFICIENT_STOCK`, show fuel name and actually available quantity; never give user a false success toast. Confirmation dialogs summarize irreversible posting and affected movements. Show historical reversal chain rather than edit controls on posted records.
