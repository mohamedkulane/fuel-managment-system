# Fuel Wholesale Management System — Documentation Pack

**Document release:** 2.1 | **Updated:** 2026-10-12 | **Status:** Implemented local application with confirmed fuel and access rules.

A single-business, staff-operated wholesale **diesel (Naafto)** and **petrol (Basiin)** inventory, ordering, manual-delivery, invoicing, collections, and reporting system.

**Fundamental vocabulary:** stock is purchased, received, displayed and sold in **fuusto**. The confirmed fixed conversion is **1 fuusto = 240 liters**. Liters remain the canonical inventory measure. The daily workflow calls incoming supply **Fuel Stock Receiving / Stock Purchases**; it does not use a tanker or Booyad receiving workflow.

**Exactly two system roles:** `OWNER` and `OFFICE_EMPLOYEE`. **NO delivery-staff accounts, logins, dashboards, tasks, authentication or APIs.** Owners/office employees print or export a non-financial daily delivery list and share it manually. The office later records actual accepted quantities.

## How Codex should use this pack
1. Read `AGENTS.md`, then `docs/00-start-here.md`, `docs/09-decisions/decision-log.md`, and the phase currently authorized.
2. Follow the phase currently authorized by the owner; do not start a later phase without its exit evidence.
3. Follow phase exit gates in `docs/05-phases/phase-gates.md`; produce test evidence, migration and acceptance checklist before proceeding.
4. Track unresolved real-world questions as configurable settings or explicit owner confirmations; never invent business defaults.

## Documentation map
| Folder | Purpose |
|---|---|
| `docs/01-product/` | Scope, requirements, terminology, examples, open decisions |
| `docs/02-domain/` | Business rules, end-to-end workflows, RBAC |
| `docs/03-architecture/` | Monorepo, API, data model/ERD, pricing, inventory, finance |
| `docs/04-ui-ux/` | Design direction and per-screen requirements |
| `docs/05-phases/` | Four ordered implementation phases and quality gates |
| `docs/06-quality/` | Security and test plan |
| `docs/07-operations/` | Deployment, backup and recovery |
| `docs/08-ai/` | Copy/paste Codex instructions |
| `docs/09-decisions/` | Decisions, assumptions and issues requiring owner confirmation |

Application code lives in `apps/web`, `apps/api` and `packages/database`. These documents remain the source for scope and testable expectations. Local implementation does not imply production deployment; changing business requirements must be recorded in the decision log and relevant contract before implementation.
