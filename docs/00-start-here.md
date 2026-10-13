# Start Here — Implementation Order and Document Authority

1. `AGENTS.md`: highest-level code-agent constraints.
2. `docs/09-decisions/decision-log.md`: confirmed requirements and owner questions.
3. `docs/01-product/requirements.md` and `docs/02-domain/business-rules.md`: expected product behavior.
4. `docs/03-architecture/`: technical contract, persistence and endpoint designs.
5. `docs/05-phases/phase-XX-*.md`: work authorized for a phase.
6. `docs/06-quality/`: verification; `docs/07-operations/`: safe deployment.

Where a document conflicts with a confirmed user requirement, the confirmed requirement wins and documents must be updated consistently. One fuusto is exactly 240 liters. No Booyad receiving workflow, no driver role and no hidden stock/financial shortcuts.

## End-to-end conceptual flow
```
FUEL STOCK RECEIVING (record whole fuusto; snapshot 240 L/fuusto)
  -> warehouse stock increase
  -> OWNER updates price list as needed
  -> OFFICE creates and confirms customer order (price + fuusto L snapshot)
  -> OFFICE schedules and prints/sends non-financial daily delivery PDF
  -> OFFICE records stock physically dispatched (warehouse -> in transit)
  -> real-world transport happens OFF-SYSTEM
  -> OFFICE records accepted quantity, and disposition of undelivered quantity
  -> financial invoice generated from delivered accepted quantity
  -> payment(s) collected/allocated; outstanding balance calculated
  -> customer statement, stock/debt/sales reports (PDF/XLSX)
```

**System of record:** accepted-delivery records for billable quantity; immutable stock movements for physical balance; posted invoices/allocations/credit notes for receivables; cash/bank receipt records for collections.

## Review checkpoints
- Confirmed for phase 1: the operational unit is whole fuusto and the fixed conversion is 240 liters per fuusto. Incoming stock uses Fuel Stock Receiving / Stock Purchases.
- Confirmed for phase 2: ordinary orders use whole fuusto. Multiple accepted deliveries per order are supported, and any undelivered physical quantity is explicitly recorded as returned or still in transit.
- Before phase 3: due-date policy, allowed payment methods, receipt numbering and sale tax handling (MVP assumes no tax until configured).
- Before phase 4: confirm the purchase cost inclusion and valuation reporting policy; owner-only profitability stays hidden if costs are incomplete.
