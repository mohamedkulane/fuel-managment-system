# UI/UX Design System — Midnight Operations v3

## Status and source

This is FuelDesk's canonical visual standard. It supersedes the former
forest/mint direction while preserving all product, domain, authorization and
routing requirements elsewhere in `docs/`. Its source is the supplied
`FUELDESK_UI_REFERENCE.html` and overview image, reviewed 2026-10-08. The
separately named `UI_PATTERN_STANDARD_V3.md` and `previews/` directory were not
available at an accessible supplied path; revise this document if they provide
a later approved visual specification.

The standalone reference is a visual and interaction-pattern guide only. It
does not authorize its sample prices, metrics, people, routes, data contracts,
or state transitions for production.

## Experience brief

A disciplined, legible operations console for a real fuel wholesaler:
**Midnight Operations**. Use a midnight navy application rail, warm ivory
workspace, crisp cobalt for primary actions and focus, and restrained amber
for fuel accents and operational emphasis. It should feel editorial and calm,
not decorative; density must support rapid operational work.

## Visual tokens

| Token | Value | Intended use |
|---|---|---|
| `--night` | `#111b2e` | Navigation rail, dark feature surfaces |
| `--night-2` | `#1c2a40` | Supporting navy surfaces |
| `--paper` | `#f6f5f2` | Application workspace |
| `--surface` | `#ffffff` | Cards, dialogs and table bodies |
| `--line` | `#e8e8e5` | Borders and quiet separators |
| `--ink` | `#162034` | Headings and primary text |
| `--muted` | `#87909f` | Secondary text |
| `--blue` | `#355fea` | Primary actions, focus and active data accent |
| `--blue-wash` | `#eef2ff` | Informational and selected backgrounds |
| `--amber` | `#e9a64b` | Fuel accent and restrained operational emphasis |
| `--amber-wash` | `#fff4df` | Warning/accent background |
| `--teal` | `#12847d` | Positive state, with text/icon as well as color |
| `--teal-wash` | `#e5f5f1` | Positive status background |
| `--red` | `#d85c51` | Error/destructive state |
| `--red-wash` | `#fdf0ed` | Error background |
| `--radius-card` | `17px` | Primary card and panel radius |

Do not reintroduce forest-green primary controls or mint as the dominant
surface language. Status must never rely on color alone.

## Typography, layout and navigation

- Use `DM Sans, Inter, system-ui, sans-serif` for text and `Manrope` with the
  same fallback stack for headings/key numerals where licensed and loaded.
  Preserve Somali/English coverage and graceful fallback.
- Headings are compact and high contrast: roughly 28px titles, strong negative
  tracking and 800 weight. Dense tables remain readable; numbers use
  `tabular-nums`.
- Desktop shell: fixed 254px midnight rail, 78px contextual top bar, and a
  centered workspace with roughly 40px horizontal padding. Group navigation by
  Workspace, Inventory & Pricing, Finance and Administration.
- Active rail items use a muted navy fill with an amber leading marker. Use
  concise accessible icon controls and visible labels.
- At <=820px, collapse the rail behind an accessible menu/backdrop, remove the
  desktop rail margin, retain a 65px top bar, wrap actions and horizontally
  scroll dense tables in an explicitly labelled scroller. At <=470px, report
  tiles become one column; KPI grids remain two columns only where legible.
- Use a modest page head, uppercase cobalt eyebrow, title/description, compact
  actions, 15–18px gaps and white, quiet-bordered cards. Avoid giant toolbars
  and repeated colored cards.

## Components and interaction patterns

- **App shell:** rail, topbar/breadcrumb, role-aware user menu, mobile menu and
  route content area. Navigation visibility is not authorization; server-side
  policies still decide access.
- **Actions:** compact white secondary and cobalt primary buttons. Amber is
  emphasis, not the ordinary save/create action. Irreversible posts need clear
  labels, confirmation where appropriate and a correction/reversal path.
- **Cards and KPIs:** white surface, quiet border, large tabular number, unit
  and factual helper line. KPIs use committed server data—never demo metrics.
- **Tables:** subtle uppercase header band, compact rows, search/filter toolbar,
  accessible row actions, loading/empty/error/retry states and pagination.
- **Forms:** grouped labels/help, decimal-string validation, accessible error
  summary, server errors and cobalt focus. Posted mutations state the affected
  action and require a reason whenever policy does.
- **Badges:** compact semantic label plus text/icon/status dot. Reference names
  are examples; actual transitions remain domain-defined.
- **Details:** contextual panels, timelines and key/value rows may reduce
  navigation. Display frozen price/unit snapshots; do not recompute history.
- **Charts:** restrained and optional. Line, bar or donut charts are allowed
  only with authoritative data, underlying values and a non-chart alternative.

## Domain, financial and privacy constraints in UI

- Display Diesel/Naafto and Petrol/Basiin separately. Canonical stock is liters;
  a fuusto is configurable and 20 L is illustrative only. Show `Fuusto (N L)`
  only after an effective conversion is configured.
- Keep **Ordered**, **Dispatched**, **Accepted**, **In transit**,
  **Backordered**, **Invoiced**, **Paid** and **Outstanding** distinct. Never
  present planned sales as realized revenue.
- Confirmed orders show frozen price/conversion snapshots; accepted rather than
  requested quantity later determines invoice eligibility.
- Customer debt does not block new orders without an owner-configured hold or
  credit restriction. Office financial views exclude supplier cost/profit.
- Delivery manifest JSON, print DOM and PDFs use a strict operational allowlist:
  no price, debt, payment, tax, cost, revenue, profit or financial metadata.
  Printing does not dispatch stock.
- There are exactly `OWNER` and `OFFICE_EMPLOYEE` roles. No delivery-worker
  role, login, portal, dashboard, route or API is permitted.

## Accessibility, responsive quality and print

- Meet keyboard, focus, contrast, target-size and semantic-table requirements;
  pair status color with text/icon and respect reduced-motion preferences.
- Every data screen needs loading, empty, no-results, error/retry and no-access
  states. Successful mutations follow committed responses and invalidate/refetch
  affected TanStack Query caches.
- Use a dedicated print stylesheet. The reference demonstrates landscape A4 for
  a dense delivery list; choose orientation per approved document, repeat table
  headers and hide navigation/actions. Manifest output remains non-financial.
