# AGENTS.md — Mandatory Repository Instructions for AI Coding Agents

> Applies to all work under this repository. Read `README.md`, `docs/00-start-here.md`, the decision log and the current authorized phase before editing code. This document is a contract, not an optional suggestion.

## Objective and scope
Build a **single-business** fuel wholesale/distribution web application for Diesel/Naafto and Petrol/Basiin: inbound booyad tanker receipts, liter-based stock, fuusto sales, price snapshots, customers with persistent debts and multiple part-payments, manual delivery manifests, reconciled actual deliveries, Excel/PDF reports and owner/office-employee access.

## Non-negotiable domain rules
1. **Booyad != fuusto**: booyad is an inbound tanker truck/receipt; fuusto is an order/sale container. An illustrative 20 L fuusto is **not** a confirmed default. Require configurable liters-per-fuusto before stocking/order flows that need conversion.
2. Canonical stock is liters, independently by fuel type. Persist quantity/price/conversion snapshots on transactional rows. Never recompute historical sales from mutable price or conversion settings.
3. Prices change over time. New confirmed orders snapshot the agreed price; previously confirmed orders/invoices are never repriced by a price-list update.
4. Invoicing is based on **confirmed accepted delivered quantity**, not the original order quantity. For 20 requested/18 accepted, bill exactly 18, and explicitly reconcile the remaining 2 and their physical fuel disposition.
5. A customer may make a new order while old debt remains unless the owner explicitly configures an account hold/credit-limit restriction. Multiple payments and allocations are supported.
6. **Only two authenticated roles: `OWNER`, `OFFICE_EMPLOYEE`.** NO driver/delivery staff role, account, portal, dashboard, mobile app, dispatch login or driver API. The printed/downloaded PDF delivery list is manually given/sent outside the system.
7. Shared daily delivery manifests must NEVER contain prices, customer debt, payments, taxes, purchase costs, revenue or profit — including embedded metadata, export source, hidden print DOM or backend payload. The print/PDF route uses an allowlisted delivery DTO distinct from invoice DTOs.
8. Printing or downloading a delivery list is **not** a stock dispatch or delivery confirmation. The office records physical dispatch and later actual delivery/reconciliation.
9. Posted financial and stock movements cannot be deleted/silently edited. Use linked reversal/adjustment documents, reason, audit actor and timestamp.
10. Never use JavaScript floating-point `number` for financial arithmetic; use `Decimal`/Postgres `NUMERIC`; expose decimal values to API clients as strings.
11. Financial and inventory mutations must be transactional, concurrency-safe, and server-authorized. No overselling, double-collection or duplicate invoice/payment posting on retries.
12. Cost/profit data and price/master policy editing are OWNER-only by default. An office employee may create customers/orders, record actual delivery and collect payments as permitted. Permissions must be enforced in API AND export endpoints.

## Chosen architecture
- pnpm monorepo: `apps/web` (Next.js App Router + TypeScript), `apps/api` (NestJS REST + TypeScript), `packages/database` (PostgreSQL/Prisma), `packages/shared` (shared pure types/schemas, **no private backend business logic imported by client**).
- UI: Tailwind CSS, shadcn/ui + Radix, lucide-react, React Hook Form, Zod, TanStack Query, TanStack Table, Recharts, react-hot-toast.
- Export: ExcelJS for XLSX, PDFKit for server-generated PDF. Choose interoperable fonts when needed but do not embed unauthorized font resources.
- Docker Compose for local PostgreSQL; GitHub Actions CI. No Redis, BullMQ, Kafka, microservices or event sourcing in the initial implementation.
- Repository versions must be pinned and compatible at implementation time; do not blindly copy old package versions. Use project lockfile and security-supported releases.

## Code quality and workflows
- Strict TypeScript, ESLint/formatting, explicit DTO validation, no `any` escape hatches, no untyped financial operations; carefully named domain modules.
- Separate controllers/DTOs, services, repository/infrastructure and authorization policies. No direct Prisma from React components.
- Validation both server-side and user-friendly UI; UTC persisted, Somalia local display `Africa/Mogadishu`, calendar/report date ranges resolved in that timezone.
- Apply database-level constraints, FK/unique indexes, transaction isolation/locks; use idempotency keys for confirmation/payment/dispatch endpoints.
- Migrations: additive first where possible; committed migrations and repeatable seeds; no destructive production reset or `db push` over production.
- Maintain audit for price changes, stock receipts/adjustments, status changes, payment reversals, settings, RBAC and financial posting.
- Build proper loading, empty, validation, error and retry states; never show stale data after mutations. Invalidate/refetch related TanStack Query keys.
- Never include private cost/revenue/debt fields in the delivery manifest JSON, HTML or PDF source.
- Unit/integration/E2E tests for invariants and permissions. No phase passes with failing tests or undocumented incomplete acceptance criteria.

## Phase discipline
Work ONLY on the phase explicitly authorized by the user. Phase specs are under `docs/05-phases/`. Do not work on phase N+1 until phase N has: committed migration, working UI/API for its scope, passing lint/typecheck/unit/integration/E2E, security checks, and a written phase report. If asked to 'set up the repository' only, import documentation and scaffold with no unauthorized business implementation.

## Definition of done for every task
State: affected files, migrations, endpoints, UI routes, tests executed with actual results, tradeoffs, outstanding decisions. Never claim tests passed without running them. No mock financial totals passed off as real.

## Questions and decisions
Use `docs/09-decisions/decision-log.md` as the source of truth for unconfirmed business parameters (especially fuel container size, pricing unit, delivery and payment policy). A missing answer must not become a silent hardcoded assumption. Create an owner-configurable setting or pause **only that affected functionality**, and clearly report the constraint.

## Repository-specific instructions
If other nested `AGENTS.md` files are later added, they may specialize this guidance but **cannot weaken** domain invariants, role limitations, or data confidentiality rules above.
