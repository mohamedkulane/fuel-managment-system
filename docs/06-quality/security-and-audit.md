# Security, Privacy and Auditing

## Authentication
- Argon2id salted password hashing; robust rate limiting and generic login failure messaging.
- Secure, HttpOnly, SameSite cookie carrying opaque random session token; persist only token hash, expire/revoke on logout/disable; TLS in production.
- Cookie-based mutation APIs need CSRF protection using modern SameSite + CSRF token/origin validation as appropriate; configure CORS narrowly.
- Employee deactivation revokes sessions; owner login and role changes audit-logged.

## Authorization
- Hard-code role set for MVP: `OWNER`, `OFFICE_EMPLOYEE` only. Store role on User, enforce policy guards per route plus service-level resource checks.
- Employee allowed to collect payments and see owed customer amounts, but not owner-only supplier costs/stock valuation/profit, price/unit policy or audit-only operations.
- Never depend on hidden buttons for access control. Check PDF routes, URL tampering, filter switches, direct API calls and export endpoints independently.

## Mandatory manifest data privacy boundary
Treat printed/shared delivery sheet as **public to the specific person delivering fuel**, not a staff account view. A dedicated serializer/select projection with explicit operational field allowlist must feed all print/manifest/PDF paths. Never pass Prisma entity or invoice DTO directly to the renderer. Metadata (title, author, subject, filenames), PDF hidden text, print DOM and JSON must not contain customer balance, finance numbers, price, costs, payment methods, or accounting identifiers. Include only necessary phone/address/quantity for actual delivery. Limit retention/sharing recommendations because customer phone/address remain personally identifying.

## Money and stock controls
- Server validation + DB checks; transactional posting; idempotency keys; row lock or serializable transaction for balances; immutable journals with reversals and required reasons.
- Audit who recorded tanker arrival, who approved price, who confirmed order, who posted dispatch, who reconciled delivery, who received cash, who reversed amount.
- Store audit before/after values with secrets and sensitive supplier costs **redacted** for non-owner views; log correlation/request ID for investigation.
- Separate day-to-day employee allowed actions from owner review/adjustment actions.

## Data protection
- Restrict DB credentials, secrets and backup access; never commit `.env`, live customer data or raw PDFs of customer manifests.
- Backups encrypted at rest/in transit; documented retention and restoration. Logs no session token, password, full payment references when sensitive, or customer's full account ledger.
- Validate file and content output; limit XLSX/CSV-style formula injection from customer-entered names (`=`, `+`, `-`, `@`) by escaping spreadsheet cells appropriately. Sanitize PDF text/control characters.
- Rate-limit report exports and enforce query max windows/row bounds to avoid resource exhaustion.

## Minimum threat tests
Session expiry/revocation; CSRF on POST; SQL injection via search; cross-customer invoice allocation; user enumeration on login; employee owner-only cost export/price modification; PDF money data leak; sequential document IDs enumeration with IDOR; arbitrary reconciliation of another order's dispatch; double submission / concurrent stock decrease; incorrect date filter exfiltration.
