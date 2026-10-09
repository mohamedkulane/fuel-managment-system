# User Acceptance Testing (UAT) Test Plan

**System Name**: Fuel Wholesale Management System  
**Document Version**: 1.0  
**Target Roles**: `OWNER`, `OFFICE_EMPLOYEE`  
**Target Environment**: Staging / Sandbox Server (`http://localhost:3000`)  

---

## 1. UAT Objectives & Scope
The purpose of User Acceptance Testing (UAT) is to allow the Business Owner and Office Employees to validate the Fuel Wholesale Management System against daily operational business processes.

### Key Invariants to Confirm During UAT
1. **Container Capacity**: Confirm that Fuusto capacities (liters per unit) match real operational standards before confirming sales.
2. **Delivery List Non-Financial Confidentiality**: Confirm that printed delivery manifests given to drivers contain zero price, debt, or financial information.
3. **Confirmed Delivery Invoicing**: Confirm that commercial invoices are generated strictly based on actual accepted physical liters, not initial requested order quantities.
4. **Subledger & Payments**: Confirm that customer debt, partial payments, and installment allocations update balances accurately.

---

## 2. Role-Based UAT Test Scripts

### Part A — Business Owner UAT Test Cases (`OWNER` Role)

#### Test Case TC-OWN-01: Master Price Book & Conversion Versioning
- **Goal**: Configure fuusto capacity and fuel prices.
- **Steps**:
  1. Log in as Owner (`OWNER`).
  2. Navigate to **Pricing & Conversions** (`/pricing`).
  3. Create a new conversion version for Diesel (e.g., 20 Liters / Fuusto).
  4. Create a new price version for Diesel (e.g., $100.00 / Fuusto).
- **Expected Outcome**: New versions are active and effective. Past locked orders are unaffected.

#### Test Case TC-OWN-02: User Account Administration
- **Goal**: Create and manage office employee access.
- **Steps**:
  1. Navigate to **Settings** (`/settings`).
  2. Click **Add User**.
  3. Register an Office Employee with email, display name, and password.
- **Expected Outcome**: User is created and can log in under the `OFFICE_EMPLOYEE` role.

#### Test Case TC-OWN-03: Tanker Receipt Costing & Review
- **Goal**: Register inbound booyad tanker arrival with purchase costs.
- **Steps**:
  1. Navigate to **Tanker Receipts** (`/stock/receive`).
  2. Register a Diesel tanker receipt of 10,000 liters with purchase cost per liter.
  3. Click **Post Receipt**.
- **Expected Outcome**: Stock balance in Warehouse increases by 10,000 L. Purchase costs are visible to Owner.

#### Test Case TC-OWN-04: System Audit Trail Inspection
- **Goal**: Audit security logs for system events.
- **Steps**:
  1. Navigate to **Audit Logs** (`/audits`).
  2. Filter by entity `SalesOrder` or action `POSTED`.
- **Expected Outcome**: All master data changes, postings, and reversals display actor timestamps and payload changes.

---

### Part B — Office Employee UAT Test Cases (`OFFICE_EMPLOYEE` Role)

#### Test Case TC-OFF-01: Customer Registration & Account Management
- **Goal**: Register a new wholesale customer.
- **Steps**:
  1. Log in as Office Employee (`OFFICE_EMPLOYEE`).
  2. Navigate to **Customers** (`/customers`).
  3. Click **New Customer**, fill in name, phone, and delivery address.
- **Expected Outcome**: Customer profile created with active status and assigned customer code.

#### Test Case TC-OFF-02: Sales Order Entry & Confirmation
- **Goal**: Take a customer sales order.
- **Steps**:
  1. Navigate to **Sales Orders** (`/orders`).
  2. Click **Create Order**, select customer, select fuel type and requested fuusto quantity (e.g., 20 fuusto).
  3. Click **Confirm Order**.
- **Expected Outcome**: Order status changes to `CONFIRMED`. Snapshot price ($100) and conversion (20L) are locked.

#### Test Case TC-OFF-03: Delivery Manifest Generation & PDF Printing
- **Goal**: Generate daily manifest for driver.
- **Steps**:
  1. Navigate to **Delivery Lists** (`/deliveries`).
  2. Create delivery sheet for scheduled date, select confirmed order line.
  3. Click **Download PDF Manifest**.
- **Expected Outcome**: Printed PDF displays delivery address, customer phone, fuel type, and fuusto count. **No prices, debt, or financial fields appear.**

#### Test Case TC-OFF-04: Dispatch & Physical Reconciliation
- **Goal**: Record physical dispatch and actual customer acceptance.
- **Steps**:
  1. Navigate to **Dispatches** (`/dispatches`).
  2. Create dispatch of 20 fuusto and click **Post Dispatch**.
  3. Click **Reconcile**: Enter 18 fuusto accepted by customer, 2 fuusto physically returned to warehouse.
- **Expected Outcome**: Warehouse stock decreases by 18 fuusto equivalent (360L). Returned 2 fuusto (40L) remain in warehouse.

#### Test Case TC-OFF-05: Invoicing & Payment Collection
- **Goal**: Bill customer for accepted delivery and collect payment.
- **Steps**:
  1. Navigate to **Invoices** (`/invoices`), select unbilled delivery, click **Generate Invoice**.
  2. Verify invoice total is exactly $1,800 (18 accepted × $100).
  3. Navigate to **Payments** (`/payments`), click **Record Payment**, enter $500 payment.
- **Expected Outcome**: Invoice balance due updates to $1,300. Payment allocation receipt generated.

---

## 3. UAT Sign-Off & Acceptance Matrix

| Test Module | Tested By | Date Tested | Status (Pass / Fail) | Tester Comments |
|---|---|---|---|---|
| TC-OWN-01: Price & Conversion Versioning | Business Owner | | | |
| TC-OWN-02: User Administration | Business Owner | | | |
| TC-OWN-03: Tanker Receipts & Purchase Costs | Business Owner | | | |
| TC-OWN-04: System Audit Trail | Business Owner | | | |
| TC-OFF-01: Customer Profile Creation | Office Employee | | | |
| TC-OFF-02: Sales Order Entry & Confirmation | Office Employee | | | |
| TC-OFF-03: Delivery Manifest Printing | Office Employee | | | |
| TC-OFF-04: Dispatch & Physical Reconciliation | Office Employee | | | |
| TC-OFF-05: Invoicing & Payment Collection | Office Employee | | | |

---

## 4. Post-UAT Transition Steps
1. Review tester comments and resolution of minor feedback.
2. Confirm unresolved ADR decisions (D-016 through D-025) with Business Owner.
3. Proceed to production deployment approval.
