# Glossary, Measures and Defaults

| Term | Meaning in this project |
|---|---|
| **Booyad** | Large tanker truck bringing wholesale fuel into the business. A tanker **receipt** is a supply transaction, not a sales unit. |
| **Fuusto** | Small customer sales/delivery container. Example could be **20 liters**, but exact size(s) MUST be owner-confirmed/configured. **Not inherently 200 L/220 L.** |
| Liter (`L`) | Canonical physical inventory and measurement unit. |
| Naafto / Diesel | Fuel product, stock and price isolated from petrol. |
| Basiin / Petrol | Separate fuel product, stock and price. |
| Requested | Customer's original quantity/order. |
| Scheduled | Quantity planned for a delivery date. |
| Dispatched | Quantity physically removed from warehouse and marked in transit. |
| Accepted delivered | Quantity customer actually accepts; only this triggers normal billing. |
| Undelivered | Fuel not accepted from dispatch; must be explicitly still in transit, returned to warehouse, or otherwise reconciled. |
| Backorder | Remaining **commercial demand** to fulfill later, not a physical stock location. |
| Payment allocation | Portion of a customer receipt applied to a specific posted invoice. |
| Unapplied credit | Customer money received but not yet applied to an invoice; liability to customer. |
| Statement | Chronological posted invoices, allocations, credits, balance. |
| Price snapshot | Unit price saved to order line when confirmed; later price changes cannot alter it. |

## Design posture where business has not confirmed details
- Container size: **must be set by owner** before first order confirmation. Display sample `20 L` in documentation only; never silently seed it as official operating size.
- Incoming volume: system requires **measured actual liters** on every receipt; entered truck references are descriptive. If supplier documents use another measure, user enters converted liter quantity with original reference retained.
- Fuusto quantity: initial UI should use whole units until owner confirms fractional container sales; database supports precise decimals to avoid migration later.
- Pricing: default one active owner-managed price per fuel+container at confirmation; negotiated special prices require explicit OWNER approval, captured actor and reason.
- Currency: USD in MVP; no implicit currency conversion. Locale formatting configurable. Money scale 2, per-unit selling price scale 4; line amounts rounded once at invoice posting.
- Fees/taxes: not assumed in initial release; configurable additions require explicit documentation and independent ledger records.
- Staff scope: office can view customer invoice totals/receivables to collect cash, but cannot see supplier costs/profit/owner-only settings.
- Sale invoice point: actual **accepted** delivery, NOT placing order or exporting a PDF.
- Sale reversals: approved credit note linked to original invoice; receipt reversals distinct and audited.
- Reporting cost of goods: weighted average cost candidate for Phase 4; formal owner approval needed before profit KPI is labeled authoritative.
