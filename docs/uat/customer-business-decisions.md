# Business Decision Questionnaire & ADR Confirmation

**System Name**: Fuel Wholesale Management System  
**Target Audience**: Business Owner (`OWNER`)  
**Document Purpose**: Extract formal owner decisions on pending operational policies (D-016 through D-025).  

---

## Instructions for Business Owner
The software system has been engineered with configurable versioning and flexible policy defaults to support your exact business rules. Before proceeding to live production deployment, please review each question below, select or state your approved decision, sign, and date this form.

---

## 1. Fuusto Container Capacities (ADR D-016)
- **Question**: What is the official standard container capacity in liters per Fuusto for Diesel (Naafto) and Petrol (Basiin)? Is there one single Fuusto capacity across all products, or are there product-specific Fuusto sizes?
- **Proposed Options**:
  - Option A: Standard 20 Liters / Fuusto for both Diesel and Petrol.
  - Option B: Product-specific capacity (e.g. Diesel = 200 Liters / Fuusto, Petrol = 220 Liters / Fuusto).
  - Option C: Configurable Fuusto capacity versions created per fuel type over time.
- **Current Technical Implementation**: System supports Option C (configurable `FuelUnitVersion` per fuel type). No capacity is hardcoded.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 2. Tanker Receipt Measurement & Loss Allowances (ADR D-017)
- **Question**: When an inbound Booyad tanker arrives, how are fuel quantities measured (flow meter vs manual dipstick)? What is the maximum allowable variance threshold before logging a shortage dispute?
- **Proposed Options**:
  - Option A: Direct meter reading input in actual liters.
  - Option B: Supplier invoice expected liters vs physical dipstick measured liters, logging variance.
- **Current Technical Implementation**: System records actual received liters and optional expected liters per line.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 3. Fractional Fuusto Container Purchases (ADR D-018)
- **Question**: May a wholesale customer order fractional Fuusto containers (e.g. 2.5 fuusto), or must orders always be in whole integer fuusto units?
- **Proposed Options**:
  - Option A: Strict integer (whole) fuusto units only.
  - Option B: Decimal (fractional) fuusto units permitted.
- **Current Technical Implementation**: System stores Decimal quantities (`Decimal(18, 3)`). UI supports fractional inputs.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 4. Line Item Price Negotiation & Discount Approval (ADR D-019)
- **Question**: May an office employee enter a negotiated unit price for a customer order line that differs from the active price book? If so, is explicit Owner approval or a written reason code required?
- **Proposed Options**:
  - Option A: Price book rate is mandatory; employee cannot change price.
  - Option B: Employee may override line price with mandatory reason code.
  - Option C: Line price override requires explicit Owner approval workflow.
- **Current Technical Implementation**: Orders snapshot active price book rate or negotiated price. Override reasons logged.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 5. Credit Limits, Overdue Days & Automatic Account Holds (ADR D-020)
- **Question**: Should the system enforce an automatic account hold (blocking new sales) when a customer exceeds a specific credit limit ($) or payment overdue threshold (e.g. 30 days past due)?
- **Proposed Options**:
  - Option A: Allow new orders by default regardless of existing debt (Owner manually sets account hold `status = HOLD`).
  - Option B: Automatic account hold when outstanding debt exceeds customer `creditLimit`.
  - Option C: Automatic account hold when any unpaid invoice exceeds 30 days past due.
- **Current Technical Implementation**: System permits new orders by default (Option A), but enforces blocking when customer `status` is manually set to `HOLD`.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 6. Active Payment Methods & Mobile Money Numbers (ADR D-021)
- **Question**: Which payment collection methods are authorized for customer payments?
- **Proposed Options**:
  - Cash
  - Bank Transfer (specify bank accounts)
  - EVC Plus (specify merchant / mobile number)
  - eDahab (specify merchant number)
  - Other / Check
- **Current Technical Implementation**: Payment method enum supports `CASH`, `BANK_TRANSFER`, `EVC_PLUS`, `EDAHAB`, `OTHER`.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## 7. Inventory Costing & Profitability Valuation (ADR D-022 & D-023)
- **Question**: Which accounting method should be used to calculate unit purchase costs and net profit margins on Owner financial reports?
- **Proposed Options**:
  - Option A: Moving Weighted Average Cost per fuel type based on posted Booyad receipts.
  - Option B: First-In, First-Out (FIFO) batch costing per inbound tanker receipt line.
  - Option C: Fixed baseline cost per fuel type configured by Owner.
- **Current Technical Implementation**: System reports total confirmed invoiced revenue vs total booyad purchase costs with policy disclosures without fabricating unverified net margin formulas.
- **Business Owner Approved Decision**: __________________________________________________
- **Approved Effective Date**: ________________________

---

## Business Owner Decision Sign-Off

I, the undersigned Business Owner, have reviewed and approved the operational decisions specified above for implementation in the Fuel Wholesale Management System.

**Business Owner Name**: ____________________________________  
**Signature**:           ____________________________________  
**Date**:                ____________________________________  
