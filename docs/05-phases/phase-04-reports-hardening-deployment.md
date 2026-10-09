# Phase 04 — Dashboards, Exports, Controls and Production Launch

**Goal:** Complete operational visibility and trustworthy reports, hardened permissions, backups and production delivery.

## Deliverables
### Dashboards
- OWNER KPI panels: warehouse diesel L, petrol L, in-transit L, reserved/available, today's actual delivered sales, collections received, overdue receivables, deliveries awaiting reconciliation, order status and trend charts.
- OFFICE overview: operational orders, customer lookup, payment receipts, delivery exceptions; no owner-only supplier cost/valuation/profit widgets or API data.
- All KPIs sourced from authoritative posted journals with relevant local business date filters, no sample numbers masquerading as live.

### Reporting and exports
For each report, implement server-side filters, paginated table + PDF + XLSX exports, totals and UTC generated timestamp formatted for Somalia; preserve role restriction in both data query and exporter:
1. Customers (contacts, order/delivered totals, paid, owed).
2. Individual customer statement with running posted balance.
3. Debts: overdue and aging 0–30 / 31–60 / 61–90 / >90 days.
4. Sales by date/fuel/customer/employee (accepted and invoiced vs ordered shown distinctly).
5. Collections by date/method/collector/customer with receipt trace.
6. Stock movement (opening, receipt, dispatch, accepted, returned, adjustment, closing per fuel/location).
7. Tanker intake (measured liters, supplier/reference; cost fields **OWNER only**).
8. Delivery planned vs accepted/refused/unresolved (internal report, not transporter PDF).
9. Owner profit/valuation only if cost policy approved, purchase costs complete and reports auditable; else mark unavailable with reason.
10. OWNER-only audit trail with date/entity/user filters.

### Quality and resilience
- Strict server RBAC on exports, row/property filters and PDFs. Security checks for IDOR, CSRF, input sanitization, token rotation/session expiration, rate limiting and data leakage.
- Workloads paginated/indexed; accessibility review, responsive tablet screen, valid loading/error/empty/retry states.
- Reliable daily backups, periodic restore drill, incident response documentation, secrets handling; schema migration plan and rollout.
- CI green across lint/types/unit/integration/E2E/build/security scans; seed and test data excluded from production.

### Deployment
- HTTPS, Next.js and NestJS behind reverse proxy or managed service, production PostgreSQL, secure cookie settings, health checks and structured logs without financial secrets.
- Document staging smoke tests and production smoke tests, deploy/rollback and recovery runbooks.

## Tests — must run
- PDF/XLSX report values exactly equal ledger values, with filter/date pagination and timezone boundary tests.
- OFFICE API tampering cannot export owner purchase cost, profit or full owner audit; delivery PDF remains price-free.
- Balance after 3 booyado, 2 fuel types, many dispatch/returns matches movement journal.
- Concurrent posting, idempotency, authorization and audit passed end-to-end.
- Backups tested by restoring staging DB and reading sample customer statement without data loss (safely sanitized fixture).
- Mobile/desktop print and PDF table pagination visually checked.

## Exit artifacts
Final acceptance report, operations runbook, rollback plan, versioned deployment config, verified backups, business-owner approval and `phase-04-report.md` with honest test evidence. Do not label production ready while any financial reconciliation test is failing.
