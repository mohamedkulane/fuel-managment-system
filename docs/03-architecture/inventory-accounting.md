# Inventory Subledger and Reconciliation

## Physical accounts
For each fuel type, two physical stock locations in MVP:
- `WAREHOUSE`: fuel available on site.
- `IN_TRANSIT`: fuel physically left for a delivery but not yet accepted by customer or returned.

Logical `RESERVED` is **not** another physical stock location. It is a subset claim against warehouse stock. `AvailableToDispatch = Warehouse - ActiveReservations`; never include in-transit as immediately usable stock. Display `PhysicalTotal = Warehouse + InTransit` for reconciliation.

## Immutable movements
`InventoryMovement` stores signed delta liters per location plus `type`, fuel, source document/id, business effective time, createdAt, createdBy and reversal link. Each posted supply/dispatch/reconciliation event creates balanced movements:

| Event | Warehouse | In transit | Delivered/sold cumulative |
|---|---:|---:|---:|
| Actual incoming tanker 10,000L | +10,000 | 0 | 0 |
| Physically dispatch 400L | -400 | +400 | 0 |
| Customer accepts 360L | 0 | -360 | +360 (outflow statistic) |
| Remaining 40L physically returns | +40 | -40 | 0 |

Result: Warehouse 9,640L, In transit 0, Sold 360L. `10000 - 360 = 9640`. If refused 40L has not yet returned, `Warehouse=9600; InTransit=40`; do NOT give false 9,640L warehouse availability.

## Reservations
- Confirmation may reserve up to planned dispatch from warehouse, but do not double count reservation and physical dispatch. Reservation is removed/reduced atomically when dispatched/cancelled.
- Use a per-fuel inventory balance row and conditional `UPDATE ... WHERE available >= requested` or locks to avoid concurrent over-commit. Quantities nonnegative in every persisted physical bucket.
- A receipt adds warehouse only once; idempotency uniqueness checks protect retries.

## Audited physical corrections
Only OWNER can post adjustments with fuel, location, positive/negative liters, reason, evidence/notes and actor. Prefer explicit correction of mistaken source event if safe. Reconciliation report compares receipt liters, issued/accepted/returned liters and current on-hand; an adjustment is not a substitute for normal delivery transactions.

## Batch/cost
TankerReceiptLine links purchase cost and actual liters. Owner-only weighted-average valuation may be added in Phase 4 after business confirmation. Do not expose invented inventory valuation or profit when cost input is absent. Keeping origin batch references is useful for audits; MVP does not promise full batch-specific FIFO physical picking.

## Anti-corruption checklist
No negative warehouse/in-transit, no double post, no outflow without matching transit, printed manifest does not mutate stock, fuel A movements never touch fuel B, and all balances reconcile from ledger within the configured decimal precision.
