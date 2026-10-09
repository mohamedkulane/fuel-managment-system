# FuelDesk V4 — Petrol & Lime

A complete design-reference kit for redesigning the existing wholesale fuel management UI across all modules. **NOT** a finished backend application.

## Contents

- `index.html`: Visual prototype entry point.
- `styles.css`: Design tokens, layout, components, responsive behavior and print CSS.
- `app.js`: Self-contained interactive 28-screen prototype with ILLUSTRATIVE data only.
- `docs/UI_DESIGN_SYSTEM_V4.md`: Approved new visual language, components, UI page catalog and domain constraints.
- `GEMINI_IMPLEMENT_PROMPT.md`: Copy/paste instructions for Gemini to refactor the real Next.js UI, including login defect verification.
- `previews/`: Desktop and mobile PNG previews captured from the rendered prototype.

## How to view

Open `index.html` in a browser, or serve this folder locally with `python -m http.server 8000` then open `http://localhost:8000/index.html`. The UI demo can navigate through page sections with left sidebar. The login page is accessible by signing out; its demo password does **not** authenticate anyone.

Try `#dashboard`, `#login`, `#customers`, `#customer-profile`, `#customer-ledger`, `#orders`, `#new-order`, `#order-detail`, `#stock`, `#tankers`, `#tanker-detail`, `#receive`, `#pricing`, `#price-history`, `#deliveries`, `#manifest`, `#dispatches`, `#reconcile`, `#invoices`, `#invoice-detail`, `#payments`, `#payment-detail`, `#debts`, `#reports`, `#audits`, `#team`, `#settings`.

A subset of visual prototype interactions works: route navigation, search, customer tabs, modals, in-memory rate changes, simple demo customer creation and browser print views. Actual records, API calls, security, PDF generation and persistent writes are intentionally **not implemented** in this frontend-only visual prototype; they already belong to your real fuel management repository and must remain there.

## Applying with Gemini

1. Extract this ZIP into your **real repository** under `design-reference/fueldesk-v4/` (or provide the folder as input to Gemini).
2. Send Gemini `GEMINI_IMPLEMENT_PROMPT.md`.
3. Have Gemini use `docs/UI_DESIGN_SYSTEM_V4.md`, prototype and screenshots as visual references while **preserving existing business logic**.
4. Ask for route-by-route screenshot QA and live API verification, particularly the screenshot's `Cannot POST /auth/login` problem.

## Brand palette

`#003333` deep petrol; `#99CC33` lime; supporting neutral `#F6F8F5`; white cards. No previous midnight navy or cobalt blue as primary palette.
