# Production Readiness Checklist

**System Name**: Fuel Wholesale Management System  
**Audit Date**: October 9, 2026  
**Status**: CONDITIONAL APPROVAL (Technically Complete & Ready for UAT; Live Launch pending Owner Policy Decisions)

---

## 1. Technical & Software Architecture Checklist

- [x] **Monorepo Architecture**: Clean pnpm workspace layout (`apps/web`, `apps/api`, `packages/database`, `packages/shared`).
- [x] **TypeScript Strictness**: `pnpm typecheck` compiles cleanly across all workspace packages with zero `any` escape hatches.
- [x] **Production Web Build**: `pnpm --filter @fuel/web build` succeeds with Next.js 15 production optimization across all 24 static and dynamic routes.
- [x] **Database ORM & Migrations**: Committed Prisma migrations applied via `prisma migrate deploy`. Schema validation (`prisma validate`) passed.
- [x] **Automated Integration Testing**: 44 out of 44 automated integration tests passed cleanly in `apps/api`.

---

## 2. Security, Authentication & Role Authorization Checklist

- [x] **Authentication**: Cookie-based HTTP-only session tokens (`fuel_sid`) hashed in PostgreSQL database (`Session` table).
- [x] **Role Authorization Enforcement**: Only two roles exist (`OWNER`, `OFFICE_EMPLOYEE`). Server-side `SessionGuard`, `requireOwner`, and `requireActor` enforced on APIs.
- [x] **Data Redaction & Confidentiality**:
  - Tanker receipt purchase costs (`unitPurchaseCost`, `totalPurchaseCost`) redacted for `OFFICE_EMPLOYEE` users.
  - Financial Profitability Summary and System Audit Trail logs restricted to `OWNER` role (`403 Forbidden`).
- [x] **Zero Driver Account Invariant**: Confirmed that zero driver accounts, logins, mobile portals, or driver APIs exist.
- [x] **Non-Financial Delivery List Isolation**: Delivery sheet JSON DTO and printed PDF manifests contain zero pricing, debt, payment, or financial fields.

---

## 3. Financial Ledger & Data Integrity Checklist

- [x] **PostgreSQL Decimal Arithmetic**: All financial calculations use `@db.Decimal(20,4)`. Fuel liters use `@db.Decimal(18,3)`. Conversion factors use `@db.Decimal(18,6)`.
- [x] **Confirmed Delivery Invoicing**: Invoicing is strictly calculated on confirmed accepted delivered physical quantities (D-023).
- [x] **Snapshot Immutability**: Confirmed orders freeze agreed price snapshots and liters-per-fuusto conversion snapshots. Subsequent master price edits never alter historical orders or invoices.
- [x] **Idempotency & Concurrency**: Server-side `Idempotency-Key` header enforcement prevents duplicate posting of payments, dispatches, and orders.
- [x] **Subledger Audit & Reversals**: Double-entry `CustomerLedgerEntry` running balances maintained. Posted invoices and payments are never silently deleted; linked reversal records are used.

---

## 4. Reporting, Analytics & Timezone Alignment Checklist

- [x] **Mogadishu Business Date Alignment**: All daily aggregates and report date filters resolve start/end of day boundaries in local Somali timezone (`Africa/Mogadishu`, `+03:00`).
- [x] **10 Core Business Reports**: Complete implementation with JSON preview, PDFKit PDF generation, and ExcelJS (`.xlsx`) downloads.
- [x] **Executive BI Dashboard**: Real-time KPI cards for debt, unapplied credits, warehouse/in-transit fuel balances, and analytics trends.
- [x] **Profitability Disclosures**: Costing policy status disclosed (D-022) without displaying fabricated net margin numbers.

---

## 5. Operations, Disaster Recovery & VPS Deployment Checklist

- [x] **Deployment Documentation**: Complete deployment sequence documented in `docs/07-operations/production-runbook.md`.
- [x] **Cross-Platform Backup & Restore Scripts**:
  - Linux/Ubuntu VPS scripts: `packages/database/scripts/backup.sh` & `restore-test.sh`.
  - Windows PowerShell scripts: `packages/database/scripts/backup.ps1` & `restore-test.ps1`.
- [x] **Restoration Drill**: Verified backup creation and test restoration drill using `pg_dump` and `psql` against isolated test database.
- [x] **Health Check Endpoint**: `GET /api/v1/health` returns status `ok`, timestamp, and process uptime.

---

## 6. Review of Pending Owner Policy Decisions (ADR Status)

Live deployment must remain held until the Business Owner provides explicit confirmation on the following pending policy items:

| ADR ID | Decision Item | Status | Action Required Before Live Deployment |
|---|---|---|---|
| **D-016** | Fuusto Default Capacities | `OWNER CONFIRMATION` | Business Owner must confirm official Fuusto conversion size(s) for Diesel and Petrol. |
| **D-017** | Tanker Receipt Tolerance | `OWNER CONFIRMATION` | Confirm dipstick variance allowance rules for incoming tankers. |
| **D-018** | Fractional Fuusto Sales | `OWNER CONFIRMATION` | Confirm whether customers may order partial fuusto containers. |
| **D-019** | Negotiated Price Approval | `OWNER CONFIRMATION` | Confirm owner override approval workflow for custom line prices. |
| **D-020** | Credit Limit & Hold Thresholds | `OWNER CONFIRMATION` | Confirm default credit limits ($) and days overdue before automatic hold. |
| **D-021** | Enabled Payment Methods | `OWNER CONFIRMATION` | Confirm active bank accounts and mobile money numbers (EVC Plus, eDahab). |
| **D-022 / D-023** | Inventory Costing Valuation | `OWNER CONFIRMATION` | Confirm cost valuation policy (FIFO vs Moving Weighted Average) for profit reports. |

---

## 7. Production Readiness Final Sign-Off

```
[X] Technical Implementation Complete: PASSED
[X] Automated Integration Testing:    PASSED (44/44 Tests Passed)
[X] TypeScript Typecheck & Build:    PASSED
[X] Security & RBAC Enforcement:      PASSED
[X] User Acceptance Testing (UAT):     READY FOR UAT
[ ] Live Production Deployment:       CONDITIONAL (Pending Owner ADR Decisions D-016 to D-025)
```
