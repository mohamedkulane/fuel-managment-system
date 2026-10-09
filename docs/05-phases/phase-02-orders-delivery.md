# Phase 02 — Sales Orders + Manual Delivery and Inventory Reconciliation

**Goal:** Stable order price snapshots, manual non-financial delivery lists and correct physical movement even when ordered and accepted quantities differ. **No driver staff accounts or portal**.

## Deliverables
### Orders
- Customer order draft/create/edit, multi-line fuel, fuusto size, requested quantity, address, date; support new order while customer has existing old debt (once finance added), subject to explicit owner hold.
- Confirm order: lock current price and liters/unit snapshot in one transaction; no retroactive repricing. Track transitions and audit without arbitrary `manage status` button.
- Order detail and list show requested vs scheduled/actual quantities with understandable status; no destructive edits to confirmed quantities.

### Manual daily delivery paperwork
- Select date + eligible orders; create/revise DeliverySheet + lines.
- Clean print-safe HTML and PDFKit server PDF via **strict allowlisted operational DTO**: date, ref, customer, phone, address, diesel/petrol, scheduled quantity, instructions and optional blank acknowledgment/accepted columns.
- Buttons `Print Delivery List`, `Download PDF`; external paper/WhatsApp sharing happens **outside system**, no delivery worker login.
- Printing/reprinting has **no stock movement** and never changes order to delivered automatically. Test PDF text extraction and binary metadata for financial leakage.

### Physical dispatch and result reconciliation
- Explicit `Dispatch` action when physical fuel leaves warehouse: atomic warehouse decrement/in-transit increment, prevent negative available stock, transaction/idempotency/audit.
- Office records actually **accepted** quantity after manual feedback; accepted reduces transit to sold, returned fuel only re-enters warehouse when physically present. Any still missing/refused fuel stays transit until accounted for.
- Distinguish commercial remaining (cancel/backorder) from physical remaining (returned/still transit).
- Support 20 scheduled, 20 dispatched, 18 accepted, 2 returned (or unresolved), with historical 20 intact and only 18 billable later.
- Persist unique accepted-delivery `billingSourceKey` for Phase 3; no pretend invoices/payments before phase 3.

## API/model work
Create `SalesOrder`, `SalesOrderLine`, `OrderEvent`, `DeliverySheet`, `DeliverySheetLine`, `Dispatch`, `DispatchLine`, `DeliveryConfirmation`, `DeliveryConfirmationLine`, `StockReservation`. Corresponding orders/delivery-sheet/dispatch/reconcile endpoints; `StockBalance` and journal updates locked transactionally.

## Tests — must run
1. Day 1 order confirmed $100/fuusto remains $100 after owner changes master to $120 for day 2; new order sees $120.
2. Fuusto conversion snapshot unchanged after owner creates new conversion version.
3. Sheet selection by exact local date includes only appropriate orders and ordered/scheduled quantities.
4. PDF and printable HTML + manifest JSON contain no forbidden financial fields; no driver API routes.
5. Printing 10 times causes 0 stock changes.
6. 20 dispatched / 18 accepted / 2 returned gives warehouse expected liters, no leftover transit, billable 18 only.
7. If 2 not returned, transit correctly retains their liter equivalent; cannot silently close physical reconciliation.
8. Two simultaneous dispatches cannot oversell; repeat idempotency key cannot dispatch twice.
9. OFFICE may generate/confirm manual delivery; cannot see tanker cost or edit master prices.
10. Multiple partial actual deliveries never collectively exceed remaining order quantity.

## Exit artifacts
Full UI/API for order and manual operational delivery flow, non-financial A4 PDF test fixture, stock reconciliation test results, `phase-02-report.md`, owner approval before Phase 3.
