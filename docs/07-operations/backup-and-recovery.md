# Backup, Restore and Data Reconciliation

## Backup policy
- Encrypted automated PostgreSQL backups at least daily, with periodic transaction log/PITR strategy if hosting supports it and business recovery objective requires it.
- Maintain copies outside the application server/storage; access only authorized operators. Retention and restore-test cadence to be approved by owner/provider policy.
- Record backup timestamp, size, validation, encryption and last successfully tested restore.
- If report PDFs or customer attachments are persisted, include them in backup/retention plan; generated downloadable reports may be regenerated if source data is intact.

## Restore drill (staging only)
1. Take latest sanitized or authorized backup.
2. Restore into isolated, non-production PostgreSQL.
3. Run schema checks and app in staging test mode.
4. Verify `sum(receipts) - sum(sold/adjustments) = warehouse + inTransit` by fuel, and customer outstanding from posted invoices/credits/allocations.
5. Verify latest relevant order, price snapshots, payment receipts, delivery confirmations and audit rows still exist.
6. Document drill date, tested backup, outcome, gaps, RPO/RTO expectations.

## Daily operational checks
- Every fuel: opening physical total + posted incoming receipts + adjustment deltas - accepted sold = closing physical total (include warehouse + in-transit).
- Every dispatch: posted dispatched = accepted + physically returned + still transit, for all events cumulatively.
- Every invoice: total >= sum valid applied allocations/credits and there are no duplicate delivery billing events.
- Every customer: posted amount due reconciles with allocations; unapplied funds shown separately.
- Every price: confirmed historic sales point to fixed price snapshot; no retroactive change.

## Incident actions
Pause affected posting paths on discrepancy; preserve logs and audit; clone database for investigation; create controlled correction/reversal based on evidence and OWNER authorization; rerun assertions after correction. Never quietly overwrite history, delete posted rows or patch the displayed balance as a shortcut.
