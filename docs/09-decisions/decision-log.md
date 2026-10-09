# Decision Log — Confirmed, Proposed and Pending

Use this as a living ADR-lite. `CONFIRMED` items reflect user requirements, `PROPOSED` are sound architecture defaults, and `OWNER CONFIRMATION` need real business input before dependent features launch.

| ID | Status | Topic | Decision / open item |
|---|---|---|---|
| D-001 | CONFIRMED | Products | Diesel/Naafto and Petrol/Basiin; keep separate balances. |
| D-002 | CONFIRMED | Booyad | Large inbound fuel truck; register each actual receipt, any number. |
| D-003 | CONFIRMED | Fuusto | Smaller customer container. **20 L is an example only; neither 200 L nor 220 L should be hardcoded.** |
| D-004 | CONFIRMED | Roles | Only Owner and Office Employee. No delivery staff system access. |
| D-005 | CONFIRMED | Delivery paperwork | Manually print/download non-financial daily orders list (and optionally send PDF via external messaging). |
| D-006 | CONFIRMED | Actual delivery | Requested qty may differ from accepted; office updates actual delivered qty and tracks difference. |
| D-007 | CONFIRMED | Pricing | Mutable master price, immutable confirmed-order line price snapshot. |
| D-008 | CONFIRMED | Credit | Outstanding customer debt does not itself prevent further orders; installment payments allowed. |
| D-009 | CONFIRMED | Exports | Customer/debt/stock/sales/collections reports exported as clean tables to PDF and Excel. |
| D-010 | PROPOSED | Canonical inventory | Liters with decimal precision; configured fuusto->liters conversion version. |
| D-011 | PROPOSED | Architecture | Single-business modular monolith (Next.js, NestJS, PostgreSQL, Prisma, pnpm). |
| D-012 | PROPOSED | Billing | Invoice after accepted delivery; every posted delivery billing event unique. |
| D-013 | PROPOSED | Stock physical states | Warehouse and in-transit; reserves nonphysical; manual dispatch/reconcile. |
| D-014 | PROPOSED | Currency | USD only in MVP; add FX only after separate design. |
| D-015 | PROPOSED | Accounting | Posted invoice - allocations - applied credits, plus separate unapplied customer credit. |
| D-016 | OWNER CONFIRMATION | Fuusto size(s) | Exactly how many liters per fuusto? One size or multiple? Any fuel-specific difference? Must be set up before confirming sales. |
| D-017 | OWNER CONFIRMATION | Incoming tankers | Are receipts entered directly in actual liters? Any meter readings, loss allowance, supplier differences? |
| D-018 | OWNER CONFIRMATION | Fractional units | May a customer buy partial fuusto or always whole containers? Initial UI whole unit. |
| D-019 | OWNER CONFIRMATION | Orders | May customer negotiate price? If so owner approval and reason required. |
| D-020 | OWNER CONFIRMATION | Credit terms | Due date default and optional limits/holds; new sales allowed by default. |
| D-021 | OWNER CONFIRMATION | Payment methods | Cash, bank, EVC Plus, eDahab — choose enabled methods and references. No automatic gateway integration. |
| D-022 | OWNER CONFIRMATION | Expenses/tax | Shipping charges, taxes, supplier costs, how included in invoices and profitability. None invented in MVP. |
| D-023 | OWNER CONFIRMATION | Cost calculation | Proposed moving weighted average cost per fuel for owner-only profit; confirm before implementation. |
| D-024 | OWNER CONFIRMATION | Offices/warehouses | One physical warehouse location in MVP; request design review if there are multiple. |
| D-025 | OWNER CONFIRMATION | Order fulfillment | Partial delivery may be accepted now and remainder rescheduled/backordered; this design supports both. Confirm operational policy. |

When an answer arrives, update its row to `CONFIRMED`, document any changed contract and add tests. **Never fill unanswered owner decisions with convenient fake production data.**
