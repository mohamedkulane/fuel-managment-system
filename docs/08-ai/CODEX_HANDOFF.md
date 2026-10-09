# Codex Handoff — Paste-Ready Instructions

## A. Import this documentation into my repository (documentation-only task)

```text
You are working on my Fuel Wholesale Management System repository.

I am providing a ZIP called fuel-wholesale-docs-v2.zip containing README.md, AGENTS.md and a complete docs/ hierarchy.

TASK NOW: First inspect the target repository and its existing files. Copy/merge the documentation into the repository root while preserving existing real source code and non-conflicting user changes. The new AGENTS.md must be at repository root. Show exactly which files you added/updated, identify any conflicting requirements and do not silently overwrite existing AGENTS.md guidance. Do NOT implement any application phase yet.

Read AGENTS.md, docs/00-start-here.md, docs/09-decisions/decision-log.md and all four phase specs. Preserve the fundamental rules: booyad is incoming tanker truck; fuusto is a configurable small container (20L just an example), inventory in liters, price snapshots; old debt plus new orders; invoices based on accepted quantity; two user roles only (OWNER and OFFICE_EMPLOYEE), zero driver accounts; driver delivery is entirely manual using a non-financial printed/PDF list.

When import is complete, report the documentation tree, missing owner-confirmations from the decision log, and the proposed implementation sequence. Wait for my explicit approval before Phase 01 coding.
```

## B. Start Phase 01 (send separately only after the imported docs are reviewed)

```text
Read the repository-root AGENTS.md, docs/00-start-here.md, docs/09-decisions/decision-log.md, docs/03-architecture/*.md, and docs/05-phases/phase-01-foundation-inventory.md.

Implement Phase 01 only, with database migrations, tested NestJS REST API, Next.js screens, role permissions, incoming booyad receipts and accurate liter inventory. Do NOT implement orders, delivery, invoices, payments or reports beyond any explicitly scoped P1 infrastructure. Do not invent a fuusto default; ask for confirmed configuration when required to use conversion, or implement owner setup without forcing a specific size.

Run lint, typecheck, unit, integration, E2E and build where relevant; show genuine commands/results, migrations and acceptance evidence. Create docs/phase-reports/phase-01-report.md. Stop before Phase 02 until I authorize it.
```

## C. Template for subsequent phases

```text
Read AGENTS.md, the decision log, docs/05-phases/phase-gates.md, the current phase specification and its dependent domain/architecture docs. Confirm previous phase exit gate using actual tests/report. Implement ONLY the phase I am authorizing. Maintain all cross-phase invariants, add tests, update documentation and generate a truthful phase report. Do not automatically begin the next phase.
```

## Suggested importer checklist
- [ ] Unzip documentation locally.
- [ ] Put `AGENTS.md` and `README.md` at repo root; `docs/` directly under root.
- [ ] Read/resolve any preexisting architecture or agent guidance conflicts.
- [ ] Confirm `docs/09-decisions/decision-log.md` statuses; obtain missing production-specific data from owner before dependent features.
- [ ] Do not infer a GitHub repository path/name; operate on the actual open repository.
- [ ] Save a commit containing **documentation only** with diff available for review.
