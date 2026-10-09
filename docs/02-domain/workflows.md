# Operational Workflows

## W1 — Booyad arrives and fuel is received
1. OWNER/authorized office employee opens Stock > Receive Tanker.
2. Enter optional supplier, tanker/trip reference, arrival local date/time, fuel type, expected liters (if known), actual measured liters, optional cost (OWNER-only).
3. Preview delta to that fuel's **WAREHOUSE** location; no change yet.
4. On `Post receipt`, validate positive measured liters, idempotency, permission and active fuel; transaction writes POSTED receipt, movement and stock balance atomically.
5. Audit actor/time; owner can see incoming history, balance and discrepancy.

## W2 — Price update and fresh order
1. OWNER enters new price for Diesel/Petrol+configured fuusto unit with effective date/time and reason; closing prior period is atomic.
2. OFFICE selects customer and fuel, enters fuusto quantity, planned delivery date/address; UI previews current price as of confirmation time.
3. Confirm captures **agreed** price and liters-per-fuusto snapshot; order number and order history created. Customer's old debt shown but, absent an explicit hold, does not block new order.
4. Never recalculate confirmed line amount from current PriceHistory.

## W3 — Prepare daily delivery sheet
1. OFFICE/OWNER selects local date and eligible confirmed/scheduled orders; may add safe instructions.
2. Application renders operational preview, **excluding all monetary data**.
3. `Print` opens CSS print layout; `Download PDF` generates server-side **non-financial** document.
4. Give paper or send exported PDF externally (e.g., WhatsApp). No driver account, driver assignment, tracking or driver-access API.
5. Reprints are harmless and audit count/date; no inventory movement from printing.

## W4 — Actual dispatch and partial accepted delivery
1. At physical loading, OFFICE selects intended delivery lines and confirms quantities leaving warehouse. Transaction ensures available stock and moves liters WAREHOUSE -> IN_TRANSIT. This is separate from printing a sheet.
2. After external delivery, OFFICE receives the reported outcome. Example: 20 fuusto dispatched, 18 accepted, 2 refused.
3. Record accepted 18, returned-to-warehouse 2 (after they physically arrive), no unresolved transit. In transit decreases by accepted 18 + physically returned 2; delivered sold equals 18.
4. Record commercial handling of unfilled 2: **CANCEL** remaining demand or **BACKORDER** for a future delivery. Backorder is independent of returned-inventory status.
5. Save with actor, local effective date/time and notes/reason. A billing event for 18 is available for phase 3 invoice posting.
6. If 2 have **not physically returned**, they must remain `IN_TRANSIT` until an actual return is recorded. Do not pretend fuel is back in the warehouse.
7. If there are several deliveries for same order, track each event independently; cumulative accepted cannot exceed remaining eligible quantity.

## W5 — Invoice, debt, and installments
1. Once accepted delivery finalized, finance posts one invoice from that billing event, using price/unit snapshots and its unique idempotency key. Example 18 at $120 => $2,160.
2. Customer may pay $300 now, $500 later, and $100 on another day. Record each as unique receipt with method/collector/reference.
3. Choose allocations to eligible invoices; by default FIFO oldest posted due date and then invoice ID. Credit remainder stays unapplied to customer.
4. Statement shows original invoice, each allocation, any credits and current receivable. Do not apply payment to a DRAFT or another customer's invoice.
5. OWNER correction uses linked payment reversal/credit note with reason, not edits to posted amounts.

## W6 — Day-end review and reports
1. OWNER sees diesel/petrol liters in warehouse and in transit, available quantity, delivery discrepancies, open invoices/debts, collections by cashier/method.
2. Filter report by local date range, customer, fuel and status as applicable.
3. View a paginated table and export CSV? **No, initial required exports PDF and XLSX**. Both honor RBAC and filters; no cost/profit data for office staff.
4. Compare receipt and shipment totals with stock movement ledger; investigate variance with auditable owner adjustment.

## Exception paths
- Printing wrong date: reprint correct selected orders; no stock effect.
- Incorrect physical dispatch: OWNER records documented compensating movement; cannot delete historical dispatch.
- Customer refuses entire load: accepted 0, all physical liters remain transit until actually returned, order remainder canceled/backordered according to decision.
- Partial delivery followed by remaining delivery tomorrow: invoice event per accepted delivery and separate manifest/dispatch for tomorrow.
- Unapplied money collected before invoice: store as advance/unapplied credit; allocate after invoice posting.
- Fuel shortage: atomic dispatch fails with explanatory available liters; do not allow negative stock.
