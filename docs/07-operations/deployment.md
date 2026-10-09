# Environments, Deployment and Runbook

## Supported environments
- **Development**: local Next.js/NestJS, PostgreSQL via Docker Compose, pnpm workspace.
- **Test/CI**: isolated PostgreSQL, ephemeral test users and fixtures.
- **Staging**: HTTPS production-like environment; migration rehearsal and E2E smoke.
- **Production**: HTTPS reverse proxy or managed deployment for web/API, isolated managed/VPS PostgreSQL with backups and least privilege.

## Environment variables (names illustrative; use validated schema)
```
NODE_ENV=production
DATABASE_URL=postgresql://...   # never checked into Git
SESSION_SECRET=...             # generated secret, not a demo value
WEB_ORIGIN=https://web.example   # replace with real configured domain
API_ORIGIN=https://api.example
TZ=UTC                         # DB/process UTC, business timezone separately
BUSINESS_TIMEZONE=Africa/Mogadishu
```
Other environment controls: secure cookie domain, trusted proxy/CORS, backup credentials, log level, owner bootstrap controls. Use `.env.example` placeholders only.

## Deployment sequence
1. Make and review DB backup and verify restore plan; compare schema/migrations against current production.
2. Deploy DB-compatible migration ahead of app cutover. Never use `prisma db push` on live financial database; use reviewed migration command.
3. Build/test API/web with exact lockfile, security check and health probe.
4. Roll out API and web behind TLS; validate secure sessions and CORS domain (domain changes should be configuration, not business data rewrite).
5. Smoke test two roles and RBAC, stock read, customer search, empty/order views, non-financial delivery PDF, payments and owner-only reports with a **staging fixture**, not arbitrary live test money.
6. Compare opening/closing ledger balances after migration; watch structured logs and DB health.

## Rollback
- Code rollback only when DB migration is backward-compatible. Non-backward-compatible schema changes need an approved expand-and-contract rollout; do not casually roll back database with posted newer financial data.
- On suspected corruption: stop financial posting and investigate journal/source numbers. Do not delete data to 'fix' a discrepancy.

## Monitoring
HTTP 5xx rates, DB pool/lock waits, failed report exports, suspicious repeated idempotency conflicts, authentication errors, day-close journal mismatch, overdue unreconciled in-transit stock and backup failures. Alerts to owner/admin via out-of-band operational channel.

## Business continuity
Changing domain does not erase business data. Reconfigure DNS, TLS, web/API public origin, cookie/CORS and callback URLs; keep DB and volumes intact. Verify before and after change.
