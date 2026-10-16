# Full-system repair checklist — 16 October 2026

Authorized scope: all eight phases in the owner's attached task, sequentially. This supersedes the older bilingual UI and six-link sidebar decisions. No production deployment.

## Phase 1: source audit

Current baseline: master at 3f6a888; clean worktree before this task. Existing V6.1 order attribution, supplier and expense entities, exact-once customer reversals, document branding and Somali dictionary are present and must be preserved.

Confirmed findings (not assumptions about previous versions):
- P0: integration config falls back to the working database; a test deletes fuel stock balances. Require an isolated test database/schema before running.
- P0: legacy receipt posting writes inventory without supplier payable/account effects for costed purchases.
- P0: correction posting shares ordinary outgoing balance restrictions; a valid payment reversal after spending the balance fails, including on deactivated accounts.
- P1: supplier reversal UI omits Idempotency-Key.
- P1: independent account and method inputs allow contradictory payment records.
- P1: account edit omits audit; transfer reversal and historical payment reconciliation are absent.
- P1: account history silently stops at 250 rows; financial reports are incomplete.
- P1: receipt order remaining uses later payments, changing historical meaning.
- P1: stock adjustment uses liters and has no idempotency key.
- P1: simplified order has no optional delivery date; returned remainder is not clearly distinguished from still pending fuel in the account view.
- P2: account and expense totals use JS number; forms expose redundant fields; localization remains incomplete.

Verification inventory: existing unit and PostgreSQL integration suites; no configured ESLint or browser suite. Mandatory regression coverage will include correction after spending funds, concurrency, all receiving endpoints, supplier FIFO/reversal, transfer/reversal, mapping with/without opening balance, immutable receipts, stock adjustment and privacy/RBAC.

## Progress
- [x] Phase 1: current code, documents, schema and test-risk audit
- [ ] Phase 2: critical logic fixes and regression verification
- [ ] Phase 3: missing functionality and verification
- [ ] Phase 4: simplified forms
- [ ] Phase 5: Somali localization
- [ ] Phase 6: responsive UI and PDF inspection
- [ ] Phase 7: full checks with actual results
- [ ] Phase 8: final reconciliation and comprehensive report

Tests and evidence are recorded as they execute; unchecked phases are not complete.
