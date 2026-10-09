# Customer UAT Issue Tracking Log

**System Name**: Fuel Wholesale Management System  
**Target Environment**: Staging / UAT Environment  

---

## Issue Classification Categories
- **Technical Defect (BUG)**: Software error or functional failure.
- **UI/UX Problem (UX)**: Visual layout issue, confusing button placement, or navigation difficulty.
- **Missing Requirement (REQ)**: Documented invariant or feature omitted from initial scope.
- **New Feature Request (FEAT)**: New business capability requested by customer during testing.
- **Pending Business Decision (ADR)**: Operational policy requiring Business Owner confirmation.

---

## Issue Log Table

| Issue ID | Date Reported | Category | Severity (Critical / High / Med / Low) | Workflow / Module | Summary Description | Reported By | Status (Open / Fixed / Decision Pending) | Resolution Notes |
|---|---|---|---|---|---|---|---|---|
| **ISSUE-001** | 2026-10-09 | ADR | MEDIUM | Pricing & Orders | Fuusto default capacity confirmation pending Owner review (D-016) | UAT Reviewer | Decision Pending | Configurable via `FuelUnitVersion`. |
| **ISSUE-002** | 2026-10-09 | ADR | MEDIUM | Reports & Analytics | Costing policy allocation method confirmation pending Owner review (D-022) | UAT Reviewer | Decision Pending | Disclosed on Profitability Summary report. |
| **ISSUE-003** | 2026-10-09 | UX | LOW | Reports Hub | Add direct shortcut link from BI Dashboard header to Reports Hub | QA Auditor | Fixed | Added header shortcut on `/` page. |

---

## Instructions for Logging New UAT Findings

When a business user or tester encounters an issue during UAT:
1. Assign the next sequential Issue ID (e.g. `ISSUE-004`).
2. Specify the date, category, severity, and affected screen.
3. Provide step-by-step instructions to reproduce the issue.
4. Technical defects will be resolved by the development team. New feature requests and policy decisions must be reviewed by the Business Owner prior to implementation.
