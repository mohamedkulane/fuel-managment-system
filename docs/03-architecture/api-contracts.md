# REST API Contracts — `/api/v1`

**Convention:** JSON camelCase. `id` UUID; currency/quantities as decimal **strings**, e.g. `"20.000"`, `"120.0000"`, `"2160.00"`. All mutating protected actions have `Authorization` from secure same-site cookie session; POST financial/stock endpoints require `Idempotency-Key`. Use structured response `{data,meta?}` and error `{code,message,fieldErrors?,correlationId}`. All list endpoints: `limit` (bounded), `cursor`, documented filters; return `nextCursor`, `hasNextPage`. Authorization always server-side.

## Identity and customers
| Verb | Path | Purpose / role |
|---|---|---|
| POST | `/auth/login` | credential authentication, new secure session |
| POST | `/auth/logout` | revoke own session |
| GET | `/auth/me` | current role/permissions |
| GET,POST | `/users` | OWNER-only create/read employees; fixed role enum |
| PATCH | `/users/:id/status` | OWNER deactivate/reactivate |
| GET,POST | `/customers` | both roles; search and create |
| GET,PATCH | `/customers/:id` | both roles; contact/address, not posted financial history |
| GET | `/customers/:id/history` | both roles; paginated timeline: orders/deliveries/invoices/payments |
| GET | `/customers/:id/statement` | both roles; posted financial entries/balance |

## Fuels, booyad receipts, prices
| Verb | Path | Purpose / role |
|---|---|---|
| GET | `/fuels` | list diesel/petrol |
| GET,POST | `/units` | GET both; POST owner config fuusto unit/conversion |
| GET | `/stock/balances` | location/fuel available, transit; no cost for office |
| GET,POST | `/tanker-receipts` | paginated receipts/create draft |
| POST | `/tanker-receipts/:id/post` | owner/authorized receiving permission; inventory mutation, idempotent |
| GET | `/stock/movements` | read movements; no purchase costs for office |
| POST | `/stock/adjustments` | OWNER-only, required reason |
| GET | `/prices/current?fuelId=&unitId=` | current price for orders |
| GET | `/prices/history` | historical master price timeline |
| POST | `/prices` | OWNER-only new effective version |

## Orders / printable daily deliveries
| Verb | Path | Purpose / role |
|---|---|---|
| GET,POST | `/orders` | both roles; order draft |
| GET,PATCH | `/orders/:id` | view; edit only unconfirmed draft fields |
| POST | `/orders/:id/confirm` | snapshot price/conversion, subject to stock/holds policy |
| POST | `/orders/:id/cancel` | controlled cancellation, reason; no unreconciled delivery |
| GET,POST | `/delivery-sheets` | date-filtered sheets; add scheduled lines |
| GET | `/delivery-sheets/:id/manifest-data` | **allowlisted operational data ONLY** |
| GET | `/delivery-sheets/:id/pdf` | **non-financial** PDF, `Content-Disposition: attachment` |
| GET | `/delivery-sheets/:id/print` | print-safe HTML or use same allowlisted DTO in browser |
| POST | `/dispatches` | physical stock leaves; both roles, idempotent |
| POST | `/dispatches/:id/reconcile` | accepted/returned quantities; both roles, idempotent |
| GET | `/deliveries?serviceDate=` | statuses, discrepancies (internal office financials only if appropriate) |

## Invoice, collections and reports
| Verb | Path | Purpose / role |
|---|---|---|
| GET | `/invoices` | paginated filtered posted/drafts |
| POST | `/invoices/post-from-delivery` | post accepted actual delivery once; both roles |
| GET | `/invoices/:id` | financial document authorized role |
| GET,POST | `/payments` | create real received payment; both roles |
| POST | `/payments/:id/allocate` | one or many invoices; both roles, idempotent |
| POST | `/payments/:id/reverse` | OWNER-only with reason |
| POST | `/credit-notes` | OWNER-only with reason/source |
| GET | `/reports/:reportKey` | paginated filtered report (RBAC) |
| GET | `/reports/:reportKey/export?format=pdf|xlsx` | same filter/permission as onscreen report |
| GET | `/audit` | OWNER-only trail |

`reportKey` allowlist: `customers`, `customer-statements`, `debt-aging`, `sales`, `collections`, `stock`, `tanker-receipts`, `delivery-reconciliation`, `profit` (OWNER-only), `audit` (OWNER-only). Avoid generic arbitrary model dump/export endpoints.

## Example payloads
**POST `/orders` (draft)**
```json
{
  "customerId":"<uuid>",
  "deliveryAddressId":"<uuid>",
  "requestedDeliveryDate":"2026-10-12",
  "lines":[{"fuelCode":"DIESEL","salesUnitId":"<configured-unit-uuid>","requestedUnits":"20"}]
}
```
**POST `/orders/:id/confirm`**
```json
{}
```
Server obtains the authoritative confirmation timestamp itself, selects the effective current price and unit conversion, and returns immutable snapshots. **Do not accept a caller-supplied confirmation timestamp or client posted unit prices**, except separately controlled and audited owner-authorized price overrides.

**POST `/dispatches`**
```json
{"deliverySheetId":"<uuid>","lines":[{"orderLineId":"<uuid>","dispatchedUnits":"20"}],"dispatchedAt":"2026-10-12T08:00:00Z"}
```
**POST `/dispatches/:id/reconcile`** (example assumes all refused liters physically returned)
```json
{"confirmedAt":"2026-10-12T12:00:00Z","lines":[{"dispatchLineId":"<uuid>","acceptedUnits":"18","returnedUnits":"2","commercialRemainder":"CANCEL_REMAINDER","reason":"Customer accepted 18 instead of 20"}]}
```
If refused two are still en route, enter `returnedUnits:"0"`, and the system derives 2 as outstanding transit; staff can later post a return event. **Do not count an unreturned quantity as warehouse stock.**

**POST `/payments`**
```json
{"customerId":"<uuid>","amount":"500.00","methodCode":"CASH","businessDate":"2026-10-12","reference":null,"notes":"Customer installment"}
```
**POST `/payments/:id/allocate`**
```json
{"allocations":[{"invoiceId":"<uuid>","amount":"300.00"},{"invoiceId":"<another-uuid>","amount":"200.00"}]}
```

## Error examples
`INSUFFICIENT_STOCK` (409), `ORDER_ALREADY_CONFIRMED` (409), `PRICE_NOT_EFFECTIVE` (422), `UNIT_NOT_CONFIGURED` (422), `DELIVERY_QUANTITY_EXCEEDED` (422), `UNRECONCILED_TRANSIT` (409), `PAYMENT_OVERALLOCATED` (422), `INVOICE_ALREADY_POSTED` (409), `FORBIDDEN` (403), `UNAUTHORIZED` (401), `VALIDATION_ERROR` (422). Conflict responses disclose no purchase cost.

## Delivery manifest DTO (strict allowlist)
```ts
type DeliveryManifestDto = {
  deliveryDate: string;
  sheetNumber: string;
  rows: Array<{
    orderNumber: string;
    customerName: string;
    phone: string;
    address: string;
    fuelName: string;
    scheduledQuantity: string;
    unitLabel: string;
    instructions?: string;
  }>;
};
```
No field named amount, cost, payment, debt, salePrice, profit, invoiceTotal, balance, bankReference or supplierCost. The PDF generator must accept **only** this DTO, not raw database models.
