# Test Strategy — Protect Money, Liters and Privacy

## Tooling
Vitest/Jest consistent with stack (NestJS default Jest), Supertest for HTTP, PostgreSQL integration tests against isolated database/container, Playwright E2E for browser, PDFKit output text extraction in test-only tooling, xlsx structural inspection. Use committed fixtures/seed scripts and per-test DB reset; NEVER run destructive tests on production.

## Test pyramid
- **Unit:** decimal math, liters-per-unit conversion, price effective intervals, order quantity aggregation, invoice rounding, FIFO allocation, customer statement, permission predicates.
- **Integration with real PostgreSQL:** constraints, transactions/concurrent locks, stock movements, idempotency, invoice uniqueness, payment allocations/reversals, RBAC/API.
- **E2E:** owner login, create customer, receive booyad diesel/petrol, set fuel price and fuusto size, create orders, print sheet, physical dispatch, record 18 accepted vs 20 requested, invoice, partial payment, run PDF/XLSX report.
- **Security:** HTTP endpoint negative cases, report download privilege escalation, IDOR, no financial manifest leakage and secure session use.
- **Operations:** backup/restore exercise and production migration dry run.

## Mandatory test matrix
| ID | Test | Expected invariant |
|---|---|---|
| INV-001 | Post 3 incoming booyado with actual liters | Separate diesel/petrol warehouse balances, no duplicated receipt |
| INV-002 | Concurrent physical dispatch | Combined dispatch never exceeds available liters |
| INV-003 | Print/download sheet repeatedly | Warehouse, transit, delivered unchanged |
| INV-004 | Dispatch 20 fuusto, accept 18, return 2 | Actual invoicable=18; warehouse/tranist reconcile |
| INV-005 | Dispatch 20, accept 18, return pending | Remainder stays IN_TRANSIT until physical return |
| INV-006 | Return and new backorder same order | Physical return and commercial demand treated independently |
| INV-007 | Owner adjusts stock | Reason and audit; employee adjustment forbidden |
| PRI-001 | Change $100 price to $120 tomorrow | Old confirmed order remains $100, new order $120 |
| PRI-002 | Owner changes configured fuusto liters | Existing confirmed order retains old ratio |
| PRI-003 | Overlapping effective price versions | Rejected atomically |
| FIN-001 | Invoice only accepted quantities | 20 ordered 18 accepted -> 18*$120=$2160 |
| FIN-002 | New sale with old debt | Allowed when no explicit hold |
| FIN-003 | Multiple installments | Exact outstanding amount from allocations |
| FIN-004 | Single payment allocated 2 invoices | Sum allocations <= receipt and each eligible due |
| FIN-005 | Excess payment | Separately tracked unapplied funds; AR no negative |
| FIN-006 | Duplicate posting/retry | Exactly one receipt/invoice, stable response |
| FIN-007 | Reverse payment/credit | Original persists, linked audit/correction |
| FIN-008 | Cross-customer allocation | Rejected |
| RBAC-001 | Employee GET supplier costs/profit | 403 or redacted DTO; no side-channel |
| RBAC-002 | Employee change fuel master price | 403 |
| RBAC-003 | Manifest JSON/PDF/print | No financial values/fields in body OR PDF metadata |
| RBAC-004 | Driver login/portal | No route, role or account exists |
| REP-001 | Customer statement vs posting ledger | Exact totals and chronological entries |
| REP-002 | XLSX and PDF same filters/totals | Match report data; role restrictions applied |
| TZ-001 | Local 23:59 -> next day | Somalia business date grouping correct |

## Example fixtures
- `fuelType=DIESEL`, `fuusto ownerConfiguredLiters=20` solely in test fixtures.
- Receipt A diesel 10,000 L, B petrol 15,000 L, C diesel 5,000 L.
- Order 20 fuusto diesel @ $120, physically dispatched 400 L, accepted 360 L, returned 40 L.
- Customer Ahmed 5 units @ $100 and 3 @ $120; accepted both, $200 receipt -> $660 owed.

## CI quality gate
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:unit`
5. `pnpm test:integration` (isolated PostgreSQL)
6. `pnpm test:e2e` (browser/API)
7. `pnpm build`
8. Migration validation on empty test DB and optional upgrade smoke from previous schema.

Adapt script names during scaffolding, document exact executed command/exit code; never report green tests that were not actually run. Tests should assert data state *before and after* failed mutation (rollback).
