# Relational Database Design — PostgreSQL / Prisma

**Status:** Logical contract for Codex to turn into Prisma models and SQL migrations. Not a generated Prisma schema. Use consistent singular PascalCase model names. Every primary ID is UUID, `createdAt` UTC, `updatedAt` where mutable; audit user IDs where significant. Monetary and physical amounts use `NUMERIC`, never JS float.

## Tables and core columns

### 1. Identity and settings
| Table | Principal columns / rules |
|---|---|
| `User` | id, displayName, email (unique normalized), passwordHash (Argon2id), role `OWNER|OFFICE_EMPLOYEE`, isActive, lastLoginAt, createdAt |
| `Session` | id, userId FK, tokenHash (unique), expiresAt, revokedAt, userAgentHash optional; never store raw token |
| `Setting` | key unique, jsonValue, editedBy, editedAt; only owner can change; typed validation for specific keys |
| `AuditEvent` | id, actorId nullable, entityType, entityId, action, beforeRedacted JSON, afterRedacted JSON, reason nullable, correlationId, createdAt; append-only |
| `IdempotencyRecord` | id, actorId, routeKey, idempotencyKey, requestHash, responseStatus, resourceId, createdAt; unique(actorId,routeKey,idempotencyKey) |

### 2. Master data and supplier receipts
| Table | Principal columns / rules |
|---|---|
| `FuelType` | id, code unique `DIESEL|PETROL`, displayName, active |
| `SalesUnit` | id, code unique, name, active; label for owner-defined fuusto size |
| `FuelUnitVersion` | id, fuelId, salesUnitId, litersPerUnit NUMERIC(18,6)>0, effectiveFromUtc, effectiveToUtc?, createdBy; no overlapping effective windows; immutable once used |
| `Supplier` | id, name, phone?, notes?, active |
| `TankerReceipt` | id, receiptNo unique, tankerReference?, supplierId?, arrivedAt, status `DRAFT|POSTED|CANCELLED|REVERSED`, createdBy, postedBy?, postedAt?, reversalOfId?, notes |
| `TankerReceiptLine` | id, receiptId, fuelId, expectedLiters? NUMERIC(18,3), actualLiters NUMERIC(18,3)>0, unitPurchaseCost? NUMERIC(20,4), landedCost? NUMERIC(20,2), measuredBy?, notes; cost privileged |

### 3. Pricing and customers
| Table | Principal columns / rules |
|---|---|
| `PriceVersion` | id, fuelId, salesUnitId, unitPrice NUMERIC(20,4)>0 (or owner-approved free policy), currencyCode `USD`, effectiveFromUtc, effectiveToUtc?, reason?, createdBy; no overlaps |
| `Customer` | id, code unique, name, primaryPhone, otherPhone?, notes?, status `ACTIVE|HOLD|INACTIVE`, optional creditLimit, createdBy |
| `CustomerAddress` | id, customerId, label, addressText, district?, city?, isDefault, active |

### 4. Sales and operational delivery
| Table | Principal columns / rules |
|---|---|
| `SalesOrder` | id, orderNo unique, customerId, orderDate, requestedDeliveryDate?, addressSnapshot, status, createdBy, confirmedBy?, confirmedAt?, currencyCode, notes |
| `SalesOrderLine` | id, orderId, fuelId, salesUnitId, requestedUnits NUMERIC(18,3)>0, conversionVersionId?, litersPerUnitSnapshot, requestedLitersSnapshot, priceVersionId?, unitPriceSnapshot?, currencyCode, confirmedAt?, orderedLineTotalEstimate; immutable confirmed snapshots |
| `OrderEvent` | id, orderId, lineId?, kind (CONFIRMED/SCHEDULED/CANCELLED/AMENDED), oldValues JSON?, newValues JSON, actorId, reason?, occurredAt; durable ordered quantity audit |
| `DeliverySheet` | id, sheetNo unique, serviceDate (local date), status, revision int, createdBy, createdAt, notes?; NO driver/user FK |
| `DeliverySheetLine` | id, sheetId, orderLineId, scheduledUnits, displayCustomerNameSnapshot, phoneSnapshot, addressSnapshot, fuelLabelSnapshot, instructions?; unique sheet/order-line/revision appropriately |
| `Dispatch` | id, dispatchNo unique, deliverySheetId?, status, dispatchedAt?, postedBy?, postedAt?, idempotencyKey?, notes? |
| `DispatchLine` | id, dispatchId, orderLineId, dispatchedUnits, dispatchedLiters, litersPerUnitSnapshot; nonnegative, cannot exceed eligible remaining |
| `DeliveryConfirmation` | id, confirmationNo unique, dispatchId, confirmedAt, recordedBy, notes?, status `POSTED|REVERSED`; record may cover partial dispatch; unique idempotency |
| `DeliveryConfirmationLine` | id, confirmationId, dispatchLineId, acceptedUnits, acceptedLiters, physicalReturnedLiters, unresolvedInTransitLiters, commercialDisposition `CANCEL_REMAINDER|BACKORDER_REMAINDER|NONE`, discrepancyReason?, unique billingSourceKey for accepted component |
| `StockReservation` | id, orderLineId, fuelId, reservedLiters, status `ACTIVE|RELEASED|CONSUMED`, createdAt; transaction-managed |

**Careful:** If a dispatch is reconciled in multiple events, `DeliveryConfirmationLine.physicalReturnedLiters + acceptedLiters + unresolvedInTransitLiters` represent **cumulative settlement only if explicitly modeled as a final snapshot**; prefer event-delta fields with a computed outstanding transit balance and require `sum accepted + sum returned <= dispatched`. The final unresolved-in-transit is a **derived** number, not an independently addable movement. Codex must pick and document one unambiguous accounting representation before migrations.

### 5. Inventory journal and materialized balances
| Table | Principal columns / rules |
|---|---|
| `InventoryMovement` | id, fuelId, location enum `WAREHOUSE|IN_TRANSIT`, signedDeltaLiters NUMERIC(18,3) !=0, eventType (RECEIPT/DISPATCH/ACCEPTED/RETURN/ADJUSTMENT/REVERSAL), sourceType, sourceId, sourceLineId?, occurredAt, createdBy, reversalOfId?, unique(sourceType,sourceLineId,eventType,location,sequence as needed) |
| `StockBalance` | id, fuelId, location, balanceLiters NUMERIC(18,3)>=0, version int; unique(fuelId,location); projection updated inside journal transaction |

### 6. Finance
| Table | Principal columns / rules |
|---|---|
| `Invoice` | id, invoiceNo unique, customerId, orderId, deliveryConfirmationId, issueDate, dueDate, postedAt?, status `DRAFT|POSTED`, currencyCode, totalAmount NUMERIC(20,2), postedBy? |
| `InvoiceLine` | id, invoiceId, deliveryConfirmationLineId unique, orderLineId, fuelId, soldUnits, soldLiters, litersPerUnitSnapshot, unitPriceSnapshot, netLineAmount NUMERIC(20,2) |
| `Payment` | id, receiptNo unique, customerId, amount NUMERIC(20,2)>0, paymentMethodCode, reference?, businessDate, receivedBy, postedAt?, status `POSTED|REVERSED`, reversedByPaymentId?, reversalReason? |
| `PaymentAllocation` | id, paymentId, invoiceId, amount NUMERIC(20,2)>0, allocatedAt, allocatedBy; forbid cross-customer allocation; reverse via linked event/record |
| `PaymentReversal` | id, paymentId unique, reason, reversedBy, reversedAt, auditId?; makes original+allocations ineffective, preserving rows |
| `CreditNote` | id, creditNo unique, customerId, invoiceId, amount NUMERIC(20,2)>0, reason, postedBy, postedAt, status; owner-only |
| `CreditApplication` | id, creditNoteId, invoiceId, amount NUMERIC(20,2)>0; prevent > available approved credit |
| `PaymentMethod` | code unique, label, active, optional manual-reference-required; OWNER controls enabled methods |

## Relationship map (selected)
- User 1:N receipt/order/payment/dispatch/posting/audit.
- FuelType 1:N tanker receipt lines, price versions, order lines, inventory movements/balances.
- Customer 1:N addresses, orders, invoices, payments; CustomerBalance **derived** (not independent writeable truth).
- SalesOrder 1:N SalesOrderLine; one line can be scheduled/dispatched/delivered in several events.
- Dispatch 1:N DispatchLine; confirmation lines reference dispatch lines; each accepted confirmation line maps at most one invoice line.
- Invoice 1:N InvoiceLine; Payment N:M Invoice through PaymentAllocation.

## Indexing and migrations
- Indexed `(fuelId, location)` stock; `(customerId, orderDate desc)` orders; `(customerId, issueDate desc)` invoices; `(customerId, businessDate desc)` payments; `(serviceDate, createdAt)` sheets; `(fuelId, effectiveFromUtc)` prices; `(sourceType, sourceId)` inventory movements.
- DB check `balanceLiters >= 0`, `actualLiters > 0`, positive prices unless explicit owner approved special case; unique document numbers and idempotency scope; FK constraints.
- Use SQL migration for period exclusion constraints if ORM cannot express them; Postgres extension `btree_gist` only when necessary and reviewed.
- No hard deletes of posted records; restrict cascading deletes for financial/stock journals. Carefully manage PII retention and lifecycle.
- Avoid manually maintaining `Customer.debt` as a single denormalized source of truth; use derived aggregates/reconciliation.

## Scope choices
- One company and one warehouse in MVP (subject to confirmation); no tenantId or driverId columns.
- One invoice per accepted confirmation event may include multiple lines. A single order can have multiple invoices after multiple real deliveries.
- Use `NUMERIC(20,2)` amounts and server decimal operations; API JSON strings for all decimals.
- Exact Prisma enum names can differ if mapping remains stable across DB/API/docs/tests.
