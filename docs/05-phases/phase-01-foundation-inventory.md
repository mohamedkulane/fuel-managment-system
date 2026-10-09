# Phase 01 — Foundation, Master Data, Tankers and Inventory

**Goal:** Secure working monorepo with customers, fuel types/units, historical price list and correct warehouse receipt/stock journal. This phase is **not** production-ready for sales/delivery/finance.

## Deliverables
### Repository/infrastructure
- Scaffold pnpm monorepo (`apps/web`, `apps/api`, `packages/database`, `packages/shared`), strict TS, compatible pinned lockfile, ESLint, env validation and `.env.example` (no secrets).
- Docker Compose PostgreSQL for local tests/dev, Prisma schema and migration tooling, seed OWNER from secure one-time bootstrap (env/CLI no published password), NestJS modules, Next.js layout, GitHub Actions build/test jobs.

### Authentication and permissions
- Argon2id credentials, hashed opaque cookie sessions, logout, session expiry, revoked user checks, CSRF appropriate to cookie authentication.
- Only enum `OWNER|OFFICE_EMPLOYEE`; OWNER user admin, office restricted routes. No transporter/driver role or related views.
- Audit actor, action, entity and time for login/config changes/supply postings.

### Business masters
- Seed only fuel types DIESEL/Naafto and PETROL/Basiin and safe payment codes as inactive/future if needed.
- OWNER configures fuusto size in liters before any conversion-based sales. UI labels example as example; no false 20 L assumption.
- Customers with contacts, multiple addresses, active/hold state and searchable paginated UI.
- OWNER sets effective per-fuel + unit price versions; history list and non-overlap enforcement. Frontend employee may view current sale price, not change.

### Inbound inventory
- Tanker receipt list/create, measured actual liters mandatory and expected liters optional, fuel type, supplier/tanker reference, optional owner-only purchase cost.
- Post receipt atomically creates receipt movement, updates warehouse balance and audit. Can receive multiple distinct tanker receipts. Do not misinterpret booyad as fuusto.
- Stock screen diesel/petrol separately shows warehouse liter balance, zero or computed transit, and movement history. OWNER-only stock adjustment with reason.
- Permissions filter supplier price/cost out of all office payloads.

## API/model work
Implement relevant models in database design: User/Session/Setting/Audit/Idempotency, FuelType/SalesUnit/FuelUnitVersion/Supplier, Customer/Address, TankerReceipt/Line, PriceVersion, InventoryMovement/StockBalance. Implement v1 endpoints documented in API contracts for P1 only.

## Tests — must run
- Unauthenticated cannot list customers; OFFICE cannot alter price or read tanker costs; OWNER can bootstrap employee.
- 3 receipts: diesel 10,000 L + 5,000 L, petrol 15,000 L => diesel 15,000, petrol 15,000; receipts never mix fuel.
- Duplicate receipt posting/retried request does not double stock.
- Negative/nonpositive receipt quantity fails; accidental concurrency cannot produce incorrect balances.
- Price effective periods do not overlap; changing a price preserves earlier price history.
- Configuring `20L` by OWNER allows correct liter-equivalent preview (when sales preview exists), but no such size is silently created.
- Owner-only adjustment logs reason; non-owner denied.

## Exit artifacts
Prisma migration(s), seeds/bootstrap notes, functional P1 UI/API, tests/CI, `.env.example`, `docs/phase-reports/phase-01-report.md` with actual evidence, and explicit owner approval before phase 2.
