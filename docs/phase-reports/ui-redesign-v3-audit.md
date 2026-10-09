# UI Redesign v3 — Import and Audit

Date: 2026-10-08  
Scope: documentation and visual audit only. No application code was changed.

## Evidence reviewed

- Repository-root `AGENTS.md`, `README.md`, start guide, product/domain,
  architecture, UI, phase, quality, operations, AI handoff and decision-log
  documentation.
- Existing Phase 1 and Phase 2 reports, both of which state that their phases
  are incomplete.
- Supplied `CODEX_UI_REDESIGN_PROMPT.md`, static
  `FUELDESK_UI_REFERENCE.html` source and overview image.
- Existing `apps/web` pages, styles and API utility.

The requested interactive browser walkthrough could not be completed: the
available in-app browser rejects local `file:` URLs and its policy forbids
bypassing that restriction by serving/opening the file via another route. HTML
source confirms 20 sample views and desktop/mobile CSS breakpoints. An allowed
`http(s)` URL or an already-open browser tab is needed for the route-by-route
1440px/390px review. `UI_PATTERN_STANDARD_V3.md` and `previews/` were not at
the accessible supplied paths.

## Visual reconciliation

`docs/04-ui-ux/design-system.md` now makes Midnight Operations the single
visual standard. Business constraints, route contracts and role/privacy rules
are unchanged; no demo data was copied into the application.

| Former guidance | V3 reference evidence | Resolution |
|---|---|---|
| Forest `#174B3B` primary and mint surfaces | Navy `#111b2e`, paper `#f6f5f2`, cobalt `#355fea`, amber `#e9a64b` | Replaced visual tokens and primary-action language. |
| Compact generic sidebar | Fixed 254px grouped midnight rail, amber active marker, contextual top bar | Replaced shell specification. |
| System/Inter-only typography | DM Sans body and Manrope heading/numeral treatment | Adopted with licensed/fallback requirement. |
| Generic 10px card framing | 15–18px rhythm and 17px principal-card radius | Adopted as component rhythm without changing functional spacing requirements. |
| Bar/pie/donut-only chart wording | Reference overview has a restrained line chart | Permit line/bar/donut only with authoritative data and accessible figures. |
| Print orientation only says “as appropriate” | Reference uses dense landscape A4 delivery list | Retain per-document choice; landscape is the dense-manifest pattern. |

No conflict exists on business-critical points: separate fuel balances,
configurable fuusto liters, frozen price/conversion snapshots, non-financial
manifest data, printing-not-dispatch, and the two-role boundary are reinforced
by the reference.

## Route and component inventory

The reference has 20 sample views. “Present” means a repository route exists;
it does not mean that it meets the screen specification.

| Reference view / required route | Current state | Audit finding |
|---|---|---|
| Login `/login` | Missing | No screen or client auth journey. |
| Overview `/dashboard` | Deprecated route shape | Only `/` exists; a static two-link page is not the role-aware overview. |
| Customers `/customers` | Present, minimal | Read-only table; no search, pagination, create/edit, detail or complete states. |
| Customer detail `/customers/:id` | Missing | No profile, addresses or historical tabs. |
| Orders `/orders` | Present, minimal | Read-only list; no filters, create/confirm or lifecycle detail. |
| New order `/orders/new` | Missing | No form or snapshot preview. |
| Order detail `/orders/:id` | Missing | No price/unit snapshot or lifecycle timeline. |
| Delivery lists `/deliveries` | Present, minimal | Read-only sheets; no date selection, creation, print/PDF workflow or complete states. |
| Delivery sheet `/deliveries/:sheetId` | Missing | No safe operational-detail page. |
| Reconcile `/dispatches/:id/reconcile` | Missing | No accepted/returned/unresolved reconciliation UI. |
| Fuel inventory `/stock` | Present, minimal | Raw balance table; no warehouse/transit/available view, ledger or complete states. |
| Tanker receipts `/stock/receive` | Missing | No list/create/posted receipt UI. |
| Receive tanker (reference `receive`) | Missing | No measured-liter form or owner-only cost treatment. |
| Price book `/pricing` | Present, minimal | Read-only history; no current cards, policy state or owner edit UI. |
| Payments `/payments` | Missing | Correctly not to be introduced before Phase 3. |
| Invoices `/invoices` | Missing | Correctly not to be introduced before Phase 3. |
| Reports `/reports` | Missing | Correctly not to be introduced before Phase 4. |
| Team access/admin | Missing | No owner settings or user-admin surface. |
| Workspace settings `/settings` | Missing | No unit/configuration screen. |
| Activity log `/audit` | Missing | No owner audit screen. |

Shared UI inventory: no app shell, rail, top bar, token layer, component
library, TanStack Query provider, table abstraction, RHF/Zod form layer, chart
component or loading skeleton. The global `nav`, `main`, `section` and raw
`fetch` styling are scaffolding to replace in-place, not screens to duplicate.
Existing `/`, `/customers`, `/orders`, `/deliveries`, `/stock` and `/pricing`
should be rebuilt at their existing contracts where their phase permits.

## Phase alignment and ordered plan

The current recorded state is Phase 1 incomplete. Phase 2 scaffolding also has
unmet UI, integration, idempotency and PDF-verification gates. Governance thus
prevents further P2 work or any P3/P4 financial/report screen.

1. Resolve the P1 gate: make P1 API/auth/database tests and the web build
   reliable; do not treat the minimal routes as complete.
2. Build the v3 token layer and responsive shell, then only P1-permitted views:
   login/session state, P1 overview shell, customers, stock, tanker
   receipt/receive, pricing and owner configuration. Use real API data with
   loading, empty, error, access and validation states.
3. Validate P1 role boundaries, the no-hardcoded-fuusto rule, responsive layout
   and audit evidence; complete the P1 exit report and await authorization.
4. Only after P1 passes and approval is renewed, complete Phase 2 orders,
   manifests, dispatch and reconciliation; prove print causes no stock movement
   and manifest DTO/PDF has no financial leakage.
5. Defer payments/invoices to Phase 3 and reports/financial dashboard to Phase
   4. Never ship reference sample money or metrics as production data.

## Outstanding inputs

- Provide `UI_PATTERN_STANDARD_V3.md` and previews if they differ from the CSS
  embedded in the HTML.
- Provide an allowed browser URL or open reference tab for the required
  interactive 1440px/390px audit.
- Owner confirmations D-016 through D-025 remain open, especially fuusto
  liters, measurement policy and partial-delivery policy.
