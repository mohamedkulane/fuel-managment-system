# Entity Relationship Diagrams (Mermaid)

Logical diagrams; source of truth for field constraints remains `database-design.md`. Cardinalities in partial-delivery domain allow 1:N events.

## Purchasing, products, inventory
```mermaid
erDiagram
    USER ||--o{ TANKER_RECEIPT : records
    SUPPLIER ||--o{ TANKER_RECEIPT : supplies
    TANKER_RECEIPT ||--|{ TANKER_RECEIPT_LINE : contains
    FUEL_TYPE ||--o{ TANKER_RECEIPT_LINE : measured_as
    FUEL_TYPE ||--o{ STOCK_BALANCE : has
    FUEL_TYPE ||--o{ INVENTORY_MOVEMENT : moves
    FUEL_TYPE ||--o{ FUEL_UNIT_VERSION : defines
    SALES_UNIT ||--o{ FUEL_UNIT_VERSION : converted_by
    FUEL_TYPE ||--o{ PRICE_VERSION : priced_as
    SALES_UNIT ||--o{ PRICE_VERSION : priced_per
```

## Customers, orders and non-driver delivery
```mermaid
erDiagram
    CUSTOMER ||--o{ CUSTOMER_ADDRESS : has
    CUSTOMER ||--o{ SALES_ORDER : places
    SALES_ORDER ||--|{ SALES_ORDER_LINE : contains
    SALES_ORDER_LINE ||--o{ DELIVERY_SHEET_LINE : scheduled_as
    DELIVERY_SHEET ||--|{ DELIVERY_SHEET_LINE : prints
    DELIVERY_SHEET ||--o{ DISPATCH : may_reference
    DISPATCH ||--|{ DISPATCH_LINE : contains
    SALES_ORDER_LINE ||--o{ DISPATCH_LINE : dispatched_as
    DISPATCH ||--o{ DELIVERY_CONFIRMATION : reconciled_in
    DELIVERY_CONFIRMATION ||--|{ DELIVERY_CONFIRMATION_LINE : contains
    DISPATCH_LINE ||--o{ DELIVERY_CONFIRMATION_LINE : confirmed_as
    DELIVERY_CONFIRMATION ||--o{ INVOICE : bills
```

## Finance
```mermaid
erDiagram
    CUSTOMER ||--o{ INVOICE : billed
    INVOICE ||--|{ INVOICE_LINE : includes
    DELIVERY_CONFIRMATION_LINE ||--o| INVOICE_LINE : bills_once
    CUSTOMER ||--o{ PAYMENT : pays
    PAYMENT ||--o{ PAYMENT_ALLOCATION : allocated_via
    INVOICE ||--o{ PAYMENT_ALLOCATION : receives
    INVOICE ||--o{ CREDIT_NOTE : corrected_by
    CREDIT_NOTE ||--o{ CREDIT_APPLICATION : applies
    PAYMENT ||--o| PAYMENT_REVERSAL : reversed_by
```

No `Driver`, `DeliveryStaff`, `VehicleOperator`, `DriverAssignment` or delivery-employee table in this MVP. A tanker/truck reference represents **incoming supply** only.
