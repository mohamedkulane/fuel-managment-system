# Roles, Permissions and Report Visibility

Only authenticated roles `OWNER` and `OFFICE_EMPLOYEE` exist. The delivery worker receiving a printed sheet/PDF **has no account**.

| Action / data | OWNER | OFFICE_EMPLOYEE |
|---|---|---|
| Sign in/out, own profile | Yes | Yes |
| See full financial dashboard / profit | Yes | No |
| See operational dashboard | Yes | Yes |
| Create/edit customer directory | Yes | Yes |
| Read customer orders, sale prices, posted invoices, owed balances | Yes | Yes |
| Create/confirm orders | Yes | Yes |
| Set or revise master fuel price, unit conversion | Yes | No |
| Negotiated sale-price approval | Yes | No |
| Create tanker receipt draft | Yes | Yes (if enabled) |
| Post tanker receipts or stock corrections | Yes | Optional receiving grant for receipts; **stock adjustments Owner-only** |
| Read supplier buy price, supplier costs, profit/valuation | Yes | **No** |
| Schedule/print/download non-financial manifest | Yes | Yes |
| Post physical dispatch, enter accepted qty/return | Yes | Yes |
| Post invoice from accepted delivery | Yes | Yes (only within confirmed delivery) |
| Record receipt, allocate payments, print receipt | Yes | Yes |
| Reverse posted payments, issue credit note | Yes | No |
| Financial customer statement / sales / debt exports | Yes | Yes, operational customer-account scope |
| Owner-only profit/purchase-cost exports | Yes | **No** |
| User management, policy and system settings | Yes | No |
| Full audit log | Yes | No |

**Permissions** (suggested constant names): `customers:read/write`, `orders:read/write/confirm`, `prices:read/write`, `inventory:read/receive/adjust`, `inventory_cost:read`, `dispatch:write`, `delivery:read/write/export`, `invoice:read/post`, `payments:read/receive/allocate/reverse`, `reports:operational`, `reports:financial`, `reports:profit`, `users:manage`, `settings:manage`, `audit:read`. Roles are fixed initially; per-role policy configured in server code and tested.

**Data minimization and DTO boundaries:** `DeliveryManifestDTO` only operational values; `StockOverviewDTO` for office omits costs; `OwnerStockCostDTO` privileged; `CustomerBalanceDTO` may contain customer debt for cashier. Avoid returning hidden finance fields and relying on frontend hiding; test route access directly.

**Security probes:** Unauthenticated API -> 401. Office tries PATCH price -> 403. Office requests owner cost/export URL -> 403. Manifest query parameter `includePrices=true` -> ignored/rejected; prices never serialized. No `/drivers`, `/delivery-staff`, `/driver-login` routes or enum values.
