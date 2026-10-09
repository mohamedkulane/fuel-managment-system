# Fuel Wholesale Management System — Documentation Pack

**Document release:** 2.0 | **Prepared:** 2026-10-08 | **Status:** Implementation-ready baseline with explicitly identified business confirmations.

A single-business, staff-operated wholesale **diesel (Naafto)** and **petrol (Basiin)** inventory, ordering, manual-delivery, invoicing, collections, and reporting system.

**Fundamental vocabulary:** **Booyad** = large tanker *truck / inbound supply shipment*. **Fuusto** = customer-facing *smaller container* (e.g. 20 liters is only an example); a fuusto is **not** a tanker truck or automatically a 200/220 L industrial barrel. Inventory's canonical measure is liters; customer orders may be entered in configured fuusto units.

**Exactly two system roles:** `OWNER` and `OFFICE_EMPLOYEE`. **NO delivery-staff accounts, logins, dashboards, tasks, authentication or APIs.** Owners/office employees print or export a non-financial daily delivery list and share it manually. The office later records actual accepted quantities.

## How Codex should use this pack
1. Read `AGENTS.md`, then `docs/00-start-here.md`, `docs/09-decisions/decision-log.md`, and the phase currently authorized.
2. Copy this entire directory into the **root of the target repository** (do not bury `AGENTS.md` in `docs/`).
3. Begin implementation from `docs/05-phases/phase-01-foundation-inventory.md` only. **Do not automatically implement all phases at once.**
4. Follow phase exit gates in `docs/05-phases/phase-gates.md`; produce test evidence, migration and acceptance checklist before proceeding.
5. Track unresolved real-world questions as configurable settings or explicit owner-confirmations; no invented business defaults.

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

**Not an implemented application.** These files document scope and testable expectations; neither application code nor production deployment is included. Any changing business requirement must be updated in the relevant docs before coding.
