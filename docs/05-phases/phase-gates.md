# Phase Delivery Governance

## Universal release gate
Before declaring ANY phase complete:
1. All scope items in that phase have implemented DB schema/migrations, NestJS endpoints, Next.js screens and permission checks as called for.
2. Linters/typecheck/build pass (`pnpm lint`, `pnpm typecheck`, `pnpm build`; adapt scripts and document actual commands).
3. All phase unit tests, transaction integration tests against PostgreSQL and E2E critical flows pass. Record commands and results in phase report.
4. Manual acceptance scenarios executed with sample test fixtures and expected numeric outcomes; no unconfirmed production measurement or prices silently seeded.
5. Migrations tested from fresh DB and from a representative previous schema; no destructive reset of real data.
6. Security negative tests passed (unauthorized access, role privilege escalation, export leakage).
7. Relevant docs, API examples and decision log updated with true implementation outcomes.
8. Codex summarizes files changed, test evidence, uncovered risks, and awaits **explicit authorization** to start next phase.

## Sequence
```
P1: Foundation + customers + price + tanker receipts + accurate inventory
      |
      v
P2: Orders + manual print/PDF sheets + dispatch + accepted-delivery ledger
      |
      v
P3: Invoice + credit + payments + customer statement
      |
      v
P4: full reports + dashboards + cost policies + hardening + deploy
```

## Cross-phase caveat
P2 may create **billable delivery events** without yet collecting/recognizing financial receipts in P3. Do not display final `Paid`, `Debt`, or business production readiness as though P3 finance existed. Similarly P1 cannot be used for dispatch/invoice until later phases are complete.

## Required `docs/phase-reports/phase-XX-report.md` after work
- Date, branch/commit, scope satisfied/unfinished, migrations, endpoints, UI routes, actual commands and test pass counts, security checks, 20->18 scenario result where applicable, business questions requiring owner confirmation, rollback strategy. Do not fabricate the report for a phase that hasn't run.
