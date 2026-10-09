# Business Rules and Invariants

## Units and fuel
- Exactly `DIESEL` and `PETROL` active initially; identifiers immutable. Every stock movement, receipt, order and invoice line specifies a fuel type.
- Warehouse stock canonical `liters NUMERIC(18,3)` or precision justified by actual measuring equipment. Conversion `litersPerFuusto NUMERIC(18,6)` must be positive, effective/immutable by version. Transaction lines snapshot `salesUnitId`, `litersPerSalesUnit`, `quantityInUnits` and `quantityLiters`.
- Example `20 fuusto * 20L = 400L` is instructional only. No default 20L in production unless confirmed.
- Do not change an existing conversion record that has been referenced by an order; create a new version.

## Receipts and supply
- Record one `TankerReceipt` per *physical incoming consignment/truck visit*, with as many fuel lines as actually measured. Record supplier/ref, receivedAt, expected liters optional, **actual measured liters required**, receivedBy, cost owner-only.
- POSTED receipt adds `actualLiters` to warehouse by immutable `InventoryMovement`. Draft is non-stock-affecting.
- Rejected/incorrect POSTED receipts must be reversed with compensating stock movement and owner reason, preventing reversal if downstream committed stock makes warehouse negative without reconciled correction.

## Price and sales
- New price entry defines `fuelType + salesUnit + effectiveFrom + amount`. Cannot create overlapping active validity windows for a product/unit. `priceAmount >= 0`; generally reject zero unless explicitly owner approved for free transfers.
- On order **confirmation**, capture selected price and conversion as immutable snapshots, plus reason/approvedBy if special price. Draft may preview latest price; it is not yet locked.
- Delivery/invoicing uses line's confirmed snapshot. A later master-price change must not change financial history.
- A customer having debt is *not* automatically blocked. Optional owner `accountHold` is explicit and checked at confirmation. Credit limit feature only if owner enables it; no hidden decline for old debt.

## Order and fulfillment quantities
- Maintain per line: `orderedQty`, `cancelledQty`, `scheduledQty` (via delivery sheet lines), `dispatchedQty`, `acceptedQty`, `backorderedQty` (when explicitly designated). All nonnegative and measured in transaction's snapshotted unit.
- Order quantity is a durable fact; no overwriting `20` with `18`. Allow scheduled/actual corrections through audited status events.
- Reconciliation event invariant `dispatchedLiters = acceptedLiters + physicallyReturnedLiters + unresolvedInTransitLiters` for the dispatch. Commercial remainder (cancel vs future fulfillment) is tracked separately; **backordered does not mean in transit**.
- Sum accepted across delivery events <= confirmed ordered quantity minus canceled amount. Allowed repeated partial deliveries; invoices only for accepted units not previously invoiced.
- No physical stock mutation from printing/viewing/saving a delivery sheet. Dispatch posted by office from warehouse moves liters to `IN_TRANSIT`. A returned physical quantity moves from `IN_TRANSIT` to `WAREHOUSE`. Accepted liters permanently leave `IN_TRANSIT` as sold.
- Unresolved in-transit stock must be visible and investigated; cannot close dispatch until all liters are accounted for.

## Money and customer accounts
- `InvoiceLine` is created from a unique accepted-delivery event, at snapshotted unit price. Invoice total = sum line totals (explicit rounding in cents per line) + configured verified charges/tax if introduced later.
- One delivery line/event **cannot be invoiced twice**; DB unique FK + idempotency key.
- `Payment` created only after real funds received (manual record); status POSTED means genuine confirmed receipt. Supports multiple partial payments and allocations against same or multiple invoices.
- `sum(allocations for payment) <= payment.amount`; allocations only to same customer's posted eligible invoices; `sum(invoice allocations + applied credit) <= invoice net due` at time of posting.
- Overpayment is **unapplied customer credit**, never silently deleted and never treated as negative invoice debt. Expose both `Outstanding receivable` and `Unapplied credit` and optionally net account position (clearly labeled).
- Receipt reversal adds explicit reversal record and reverses allocations as appropriate; original persists.
- Customer ledger must be reproducible from posted invoice/credit/payment-allocation documents; dashboard aggregates are projections, not alternate sources of truth.

## Privacy and controls
- Office staff may see customer sales amounts and outstanding invoices to collect cash. Owner-only are tanker purchase cost, supplier margins, valuation/profit, unit conversion/master price setting, sensitive audit/security actions.
- Daily delivery sheet allowlist: service day, order number, customer display name, phone, address, fuel label, scheduled amount with unit, instructions, optional blanks for signatures/actual qty. Nothing financial in download body or PDF metadata.
- API transaction endpoints are authenticated, permission-checked, idempotent and audit-logged. All user input validated; date and time UTC in DB, report dates local Africa/Mogadishu.

## State machines
**Receipt:** `DRAFT -> POSTED`, or `DRAFT -> CANCELLED`; `POSTED -> REVERSED` through linked reversal, not delete.

**Order:** `DRAFT -> CONFIRMED -> SCHEDULED -> IN_PROGRESS -> PARTIALLY_FULFILLED -> FULFILLED/CLOSED`; `CANCELLED` only when allowable with no unreconciled stock/money. Intermediate states may be derived from line event totals. Do not expose arbitrary status toggle.

**Delivery sheet:** `PREPARED -> PRINTED` (repeatable) and/or `SCHEDULED -> DISPATCHED -> PARTIALLY_RECONCILED -> RECONCILED`; printing is a loggable event but must not automatically advance physical state. Manifest can be re-generated with revision marker if selected rows change.

**Dispatch:** `PREPARED -> POSTED -> PARTIALLY_RECONCILED -> RECONCILED`; posted dispatch cannot be deleted.

**Invoice:** `DRAFT -> POSTED`; `POSTED` supports `OPEN / PARTIALLY_PAID / PAID` derived from ledger and later `CREDITED` using credit note; never freely editable.

**Payment:** `DRAFT/RECORDING -> POSTED -> REVERSED` via linked reversal (owner authorization). Payments are never deleted.
