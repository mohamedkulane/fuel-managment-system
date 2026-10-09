# Customer User Acceptance Testing (UAT) Guide

**System Name**: Fuel Wholesale Management System (Diesel & Petrol Distribution)  
**Target Roles**: Business Owner (`OWNER`), Office Employee (`OFFICE_EMPLOYEE`)  
**Target Environment**: Local Staging Server (`http://localhost:3000`)  
**Test Data Seed**: Pre-loaded UAT Demonstration Database  

---

## 1. Introduction & Overview

Welcome to the **Customer User Acceptance Testing (UAT)** for the Fuel Wholesale Management System. This guide provides step-by-step instructions for testing core business operations: inbound booyad tanker receiving, stock balance management, sales orders, non-financial delivery manifests, actual physical reconciliations, commercial invoicing, customer payment collection, debt tracking, and reporting.

### Test Credentials
- **Business Owner (`OWNER`)**:
  - Email: `owner@fueldesk.so`
  - Password: `OwnerPassword123!`
- **Office Employee (`OFFICE_EMPLOYEE`)**:
  - Email: `office@fueldesk.so`
  - Password: `OfficePassword123!`

---

## 2. Nontechnical Business Workflows & Test Cases

### Module 1: Tanker Receipts & Stock Management (Owner & Office)

#### Test Case TC-UAT-01: Inbound Booyad Tanker Receiving
- **User Role**: `OFFICE_EMPLOYEE` or `OWNER`
- **Business Scenario**: Register arrival of a new Diesel tanker truck carrying 10,000 liters.
- **Starting Condition**: Logged in to `/stock/receive`.
- **Steps**:
  1. Click **Receive Tanker**.
  2. Enter Tanker Reference: `Booyad SOM-999`.
  3. Select Fuel: `Diesel / Naafto`.
  4. Enter Actual Liters: `10000`.
  5. (Owner only) Enter Cost/Liter: `$0.80`.
  6. Click **Submit Draft**, then click **Post Receipt**.
- **Expected Result**: Tanker receipt transitions to `POSTED`. Warehouse stock balance for Diesel increases by exactly 10,000.000 liters.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

### Module 2: Price Book & Container Conversions (Owner Only)

#### Test Case TC-UAT-02: Fuusto Capacity & Wholesale Price Versioning
- **User Role**: `OWNER`
- **Business Scenario**: Configure a new wholesale price version for Diesel ($120/fuusto).
- **Starting Condition**: Logged in as `owner@fueldesk.so` at `/pricing`.
- **Steps**:
  1. Navigate to **Price Book & Conversions** (`/pricing`).
  2. Review current Fuusto conversion rate (20.000000 L/fuusto).
  3. Click **Add New Price Version**.
  4. Select Fuel: `Diesel`, Unit: `Fuusto`, Enter Unit Price: `120.0000`.
  5. Enter Effective Date: Today. Reason: `Q3 Rate Adjustment`. Click **Save**.
- **Expected Result**: Price version created and set as active. Existing confirmed orders remain locked at their historical agreed prices ($100/fuusto).
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

### Module 3: Customer Management & Sales Orders (Office Employee)

#### Test Case TC-UAT-03: Registering New Wholesale Customer
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Register a new wholesale customer account.
- **Starting Condition**: Logged in as `office@fueldesk.so` at `/customers`.
- **Steps**:
  1. Click **New Customer**.
  2. Enter Name: `Somali Transport Co`, Phone: `+252615000111`.
  3. Enter Delivery Address: `21 October Road, Waberi, Mogadishu`.
  4. Click **Create Customer**.
- **Expected Result**: Customer created with status `ACTIVE` and assigned a unique code (e.g. `CUS-XXXX`).
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-04: Creating & Confirming Sales Order
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Create and confirm a sales order for 20 fuusto of Diesel.
- **Starting Condition**: Logged in at `/orders`.
- **Steps**:
  1. Click **New Order**.
  2. Select Customer: `Banaadir Logistics & Transport`.
  3. Select Fuel: `Diesel / Naafto`, Sales Unit: `Fuusto`, Requested Units: `20`.
  4. Click **Create Draft Order**.
  5. On order detail view, click **Confirm Order**.
- **Expected Result**: Order status changes to `CONFIRMED`. Agreed unit price snapshot ($100 or $120) and liters per fuusto snapshot (20L) are permanently locked.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

### Module 4: Delivery Manifest Printing & Reconciliation (Office Employee)

#### Test Case TC-UAT-05: Non-Financial Delivery List Generation & PDF Download
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Prepare daily delivery list for truck drivers and print non-financial manifest.
- **Starting Condition**: Logged in at `/deliveries`.
- **Steps**:
  1. Click **Create Delivery List**.
  2. Select Service Date: Today.
  3. Check the confirmed order line for `Banaadir Logistics & Transport`. Click **Generate Sheet**.
  4. Click **Download PDF Manifest**.
- **Expected Result**: Delivery sheet created in `PREPARED` status. PDF manifest displays customer name, phone, delivery address, fuel type, and scheduled fuusto count. **PDF contains ZERO pricing, debt, payments, or financial amounts.**
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-06: Dispatch & Physical Reconciliations (18 Accepted / 2 Returned)
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Dispatch 20 fuusto and record actual delivery (18 accepted, 2 returned due to minor leak).
- **Starting Condition**: Logged in at `/dispatches`.
- **Steps**:
  1. Click **New Dispatch**, select Delivery Sheet, dispatched units = `20`. Click **Post Dispatch**.
  2. Click **Reconcile Dispatch**.
  3. Enter Accepted Units: `18`.
  4. Enter Physically Returned Liters: `40` (2 fuusto × 20L).
  5. Select Disposition: `CANCEL_REMAINDER`. Reason: `2 fuusto leaking, returned to warehouse`.
  6. Click **Submit Reconciliation**.
- **Expected Result**: In-transit stock cleared. Warehouse stock credited with 40L returned fuel. Final billed quantity locked to 18 accepted fuusto.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

### Module 5: Invoicing, Payments & Customer Debt (Office Employee & Owner)

#### Test Case TC-UAT-07: Invoicing Strictly on Accepted Delivered Quantity
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Generate invoice for the reconciled delivery.
- **Starting Condition**: Logged in at `/invoices`.
- **Steps**:
  1. Click **Generate Invoice**, select the unbilled delivery confirmation line (18 accepted fuusto).
  2. Click **Create Commercial Invoice**.
- **Expected Result**: Invoice generated for **exactly 18 fuusto** (not 20 requested). Subtotal = $1,800.0000 (18 × $100). Customer ledger balance increased by $1,800.0000.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-08: Recording Partial Payment & Debt Installments
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Customer makes a partial payment of $500 via EVC Plus.
- **Starting Condition**: Logged in at `/payments`.
- **Steps**:
  1. Click **Record Payment**.
  2. Select Customer: `Banaadir Logistics & Transport`.
  3. Enter Amount: `$500`, Payment Method: `EVC_PLUS`, Reference: `EVC-998877`.
  4. Click **Post Payment**.
- **Expected Result**: Invoice `paidAmount` updates to $500.0000, `balanceDue` updates to $1,300.0000, status updates to `PARTIALLY_PAID`. Official payment receipt generated.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-09: Ordering While Debt Exists
- **User Role**: `OFFICE_EMPLOYEE`
- **Business Scenario**: Customer places a new order while $1,300 outstanding debt remains.
- **Starting Condition**: Logged in at `/orders`.
- **Steps**:
  1. Click **New Order**, select `Banaadir Logistics & Transport` ($1,300 debt).
  2. Enter Requested Units: `10` fuusto Diesel. Click **Create Order**.
- **Expected Result**: Order is created successfully. System permits new sales to customers with debt unless explicitly set to `HOLD` status.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

### Module 6: Executive Dashboard, Reports & Security Audit (Owner Only)

#### Test Case TC-UAT-10: Business Intelligence Dashboard & Date Range Analytics
- **User Role**: `OWNER`
- **Business Scenario**: Review real-time business performance and Mogadishu date range trends.
- **Starting Condition**: Logged in as `owner@fueldesk.so` at `/`.
- **Steps**:
  1. View Executive KPI cards (Outstanding Debt, Credit, Fuel Stock in Warehouse/In-Transit).
  2. Adjust Date Range filter: From `2026-09-01` To `2026-09-30`.
- **Expected Result**: Dashboard metrics and top customer tables recalculate accurately in local Somali timezone.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-11: Report Generation (PDF & Excel Exports)
- **User Role**: `OWNER` or `OFFICE_EMPLOYEE`
- **Business Scenario**: Export Accounts Receivable Debt Aging report to PDF and Excel.
- **Starting Condition**: Logged in at `/reports`.
- **Steps**:
  1. Select **Accounts Receivable Debt Aging**.
  2. Click **Export PDF**, verify file downloads and headers alignment.
  3. Click **Export Excel (.xlsx)**, open file in Excel, verify column formulas and formatting.
- **Expected Result**: Both exports generated cleanly with complete dataset.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

#### Test Case TC-UAT-12: System Audit Logs & Role Permissions Security
- **User Role**: `OWNER` vs `OFFICE_EMPLOYEE`
- **Business Scenario**: Verify security audit logs and role restrictions.
- **Starting Condition**: Logged in as `owner@fueldesk.so` at `/audits`.
- **Steps**:
  1. Owner views `/audits` page, filters by `SalesOrder` or `POSTED`.
  2. Log out and log in as `office@fueldesk.so`. Attempt to access `/audits` or `/reports/profitability`.
- **Expected Result**: Owner views complete audit log history. Office Employee access is rejected with `Access Restricted / 403 Forbidden`.
- **Actual Result**: Pending customer test execution.
- **Pass/Fail**: `[ ] Pass  [ ] Fail`
- **Customer Comments / Approval**: ___________________________________

---

## 3. Customer Sign-Off Sheet

```
[ ] All UAT Test Cases Executed by Customer
[ ] Feedback Logged in docs/uat/uat-issues.md
[ ] Business Decision Questionnaire Signed Off in docs/uat/customer-business-decisions.md

Business Owner Name: ____________________________________
Signature:           ____________________________________
Date:                ____________________________________
```
