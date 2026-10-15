# FuelDesk V7.2 — Full Somali UI Terminology & Localization Specification

**Status:** Proposed UI language standard for Codex implementation. This file does not imply the repository has already been translated.  
**Project:** `mohamedkulane/fuel-managment-system`  
**Compatibility:** Preserve all business/finance rules from V6.1 and V7.1. This specification OVERRIDES the earlier guidance to keep English action buttons or mixed Somali/English UI: **the entire user-visible application must be in clear Somali.**  
**Sidebar:** 8 entries after V7.1: **Guudmar · Macaamiisha · Dalabyada · Kaydka Shidaalka · Kharashaadka · Akoonnada Lacagta · Warbixinnada · Dejinta**. Suppliers live under Kaydka, not as a separate sidebar item.

## Localized language standards and guardrails

- Use **short, conversational Somali** appropriate for an older business owner. Use active verbs in action buttons: **Ku dar**, **Kaydi**, **Eeg**, **Xaqiiji**, **Diiwaangeli**, **Fur**, **Jooji**, **Ka noqo**. Avoid awkward literal translations, long button text, duplicated Somali+English labels or vague accounting jargon.
- Use the glossary below as **contextual** guidance, NOT naïve global string replacement: `Pay Supplier` differs from `Receive Customer Payment`; `Customer Account` differs from `Financial Account`. English terms repeated in multiple categories have context-specific translations.
- Keep `FuelDesk`, actual company/customer names, API paths, database tables, enum values, JSON keys, IDs, email addresses, phone/account numbers, transaction references, fuel constants, USD/$, PDF/Excel and EVC Plus/Somnet brand names unchanged. Show the two fuels ONLY as **Naafto** and **Basiin**, and use **Fuusto** (1 = 240 litir).
- UI: No English action labels, placeholders, form labels, buttons, tooltips, aria-labels, chart legends, empty states, toasts, validation/errors, export controls, modal titles, navigation, role labels or visible statuses. Ensure server error codes are mapped safely to Somali; do not expose raw SQL exceptions, stack traces, or database keys.
- PDFs/printed documents (Order Invoice, Payment Receipt, Customer Statement, Delivery List, Supplier Payment Receipt): Somali section headers using table below; keep black/white A4 design; retain original numeric amounts and real business identity. Exports/Excel sheet headers should be in Somali; operational delivery manifests must never contain financial data.
- UI prices use `$1,234.50` with **2 decimal places** where relevant, dates should be human-readable to Mogadishu users (e.g. `15 Oktoobar 2026` or `15/10/2026`) without `UTC`; order/reference numbers are not translated. Somali month names should be consistent. Use Latin digits `0–9` for clarity and correct input parsing; numeric backend computation remains decimal-safe.
- Existing app routes may remain `/orders`, `/customers`, `/accounts`, etc. Translation must not alter model fields, endpoints, enums, RBAC, historical snapshots, audit records or financial math. Do not refactor accounting as a translation side-effect.
- Short fixed English technical *brand/acronym* exceptions are allowed (PDF, Excel, SMS, USD, EVC Plus, Somnet, FuelDesk), but no ordinary English UI words like `View`, `Save`, `Paid Now`, `Receipt`, `Total Sales`, `Balance`, `Account` or `Reverse Payment`.
- **Dangerous actions need context:** default dialog cancel button = **Jooji** / **Xir**; owner-only payment correction = **Ka noqo lacag-qabashada** and mandatory reason. Reversal is not a refund: never show **Lacag dib u celi** unless actual money is physically returned.

## Financial terminology that MUST be unambiguous

| Concept | Somali for owner-facing UI | Distinction |
|---|---|---|
| Customer debt (receivable) | **Lacagta macaamiisha laga sugayo** / **Deynta macaamiisha** | Customers owe the business |
| Supplier debt (payable) | **Deynta aan ku leenahay keenayaasha** | Business owes suppliers |
| Customer recorded payment | **Lacagta la qabtay** | Payment received by business |
| Supplier payment | **Lacagta keenaha la siiyey** | Money leaving business |
| Expense | **Kharash** | Not a stock purchase and not a customer payment |
| Financial account | **Akoon lacageed** | An EVC Plus number, Somnet number, Cash drawer, or bank account |
| Customer account | **Xisaabta macmiilka** | Orders, payments, and receivables; not a wallet |
| Book balance | **Haraaga diiwaangashan** | FuelDesk's balance, not live operator/provider balance |
| Total (order) | **Wadarta Dalabka** | Subtotal − fixed discount; payment doesn't reduce total |
| Paid amount | **Lacagta la bixiyey** | Linked posted, non-reversed payments only |
| Order remaining (pending delivery) | **Haraaga dalabka (weli lama geynin)** | Do not call undelivered portion actual debt |
| Actual delivered debt | **Deynta shidaalka la geeyey** | Invoice posted after accepted delivery |
| Payment reversal | **Ka noqoshada lacag-qabashada** | Accounting correction, not cash refund |
| Money In / Money Out | **Lacag soo gashay / Lacag baxday** | NOT synonymous with sales revenue / expenses |
| No purchase cost recorded | **Qiimaha soo-iibsiga lama diiwaangelin** | Unknown is NOT zero |

## Approved glossary — apply across actual screens

### 01 — Menu & navigation (30 entries)

| Current / English label | Approved Somali label |
|---|---|
| Dashboard | Guudmar |
| Customers | Macaamiisha |
| Orders | Dalabyada |
| Stock | Kaydka Shidaalka |
| Expenses | Kharashaadka |
| Accounts | Akoonnada Lacagta |
| Reports | Warbixinnada |
| Settings | Dejinta |
| Suppliers | Keenayaasha Shidaalka |
| Supplier Debt | Deynta Keenayaasha |
| Pricing | Qiimaha Shidaalka |
| Stock Receiving | Shidaal Soo Gelin |
| Delivery List | Liiska Gaarsiinta |
| Customer Account | Xisaabta Macmiilka |
| Customer Payments | Lacagaha Macmiilka |
| Profile | Xogtayda |
| Notifications | Ogeysiisyada |
| Search | Raadi |
| Search customers or orders | Raadi macmiil ama dalab |
| Open menu | Fur liiska |
| Close menu | Xir liiska |
| Home | Bogga Hore |
| Back | Dib u noqo |
| Back to Orders | Ku noqo Dalabyada |
| Back to Stock | Ku noqo Kaydka |
| View All | Eeg Dhammaan |
| Recent Activity | Dhaqdhaqaaqii Ugu Dambeeyay |
| Sign Out | Ka bax |
| Log In | Gal |
| Welcome back | Soo dhawoow |

### 02 — Universal buttons & actions (58 entries)

| Current / English label | Approved Somali label |
|---|---|
| Add | Ku dar |
| Add New | Ku dar Cusub |
| New | Cusub |
| Create | Samee |
| Save | Kaydi |
| Save Changes | Kaydi Isbeddellada |
| Update | Cusboonaysii |
| Edit | Wax ka beddel |
| Delete | Tirtir |
| Remove | Ka saar |
| View | Eeg |
| View Details | Eeg Faahfaahinta |
| Open | Fur |
| Close | Xir |
| Cancel | Jooji |
| Confirm | Xaqiiji |
| Approve | Oggolow |
| Reject | Diid |
| Continue | Sii wad |
| Next | Xiga |
| Previous | Hore |
| Go Back | Dib u noqo |
| Submit | Gudbi |
| Search | Raadi |
| Filter | Kala shaandhee |
| Clear Filters | Ka saar Kala-soocidda |
| Reset | Dib u deji |
| Refresh | Cusboonaysii |
| Retry | Mar kale isku day |
| Load More | Soo rar kuwo kale |
| Select | Dooro |
| Select All | Dooro dhammaan |
| Clear | Nadiifi |
| Copy | Koobiyee |
| Copied | Waa la koobiyeeyay |
| Download | Soo dejiso |
| Print | Daabac |
| Export | Dhoofso |
| Import | Soo geli |
| Export PDF | Soo dejiso PDF |
| Export Excel | Soo dejiso Excel |
| Open PDF | Fur PDF |
| View Receipt | Fur Rasiidhka |
| Receipt | Rasiidh |
| Invoice | Biil |
| Statement | Warbixinta Xisaabta |
| View Statement | Fur Xisaab-celinta |
| Actions | Hawlaha |
| More | Wax kale |
| More Details | Faahfaahin kale |
| Less Details | Qari faahfaahinta |
| Show | Muuji |
| Hide | Qari |
| Show More | Muuji wax dheeraad ah |
| Show Less | Qari faahfaahinta |
| Apply | Dhaqan geli |
| Done | Waa dhammaatay |
| Reopen | Dib u fur |

### 03 — Authentication, users & permissions (30 entries)

| Current / English label | Approved Somali label |
|---|---|
| Email | Iimayl |
| Password | Furaha sirta ah |
| Confirm Password | Xaqiiji furaha sirta ah |
| Show Password | Muuji furaha sirta ah |
| Hide Password | Qari furaha sirta ah |
| Forgot Password | Ma illowday furaha sirta ah? |
| Log In | Gal nidaamka |
| Log Out | Ka bax nidaamka |
| Account | Koontadayda |
| My Profile | Xogtayda |
| Name | Magac |
| Full Name | Magaca oo dhan |
| Display Name | Magaca muuqda |
| User | Isticmaale |
| Users | Isticmaaleyaasha |
| Add User | Ku dar Isticmaale |
| Employee | Shaqaale |
| Office Employee | Shaqaale Xafiis |
| Owner | Milkiile |
| Role | Doorka |
| Permissions | Ogolaanshaha |
| Status | Xaaladda |
| Active | Shaqaynaya |
| Inactive | Aan shaqaynayn |
| Locked | La xiray |
| Enable | Daar |
| Disable | Demi |
| Change Password | Beddel Furaha Sirta ah |
| Current Password | Furaha hadda |
| New Password | Fure cusub |

### 04 — Dashboard & charts (27 entries)

| Current / English label | Approved Somali label |
|---|---|
| Overview | Guudmar |
| Today's Summary | Soo Koobidda Maanta |
| Today's Sales | Iibka Maanta |
| Total Sales | Wadarta Iibka |
| Total Collected | Lacagta La Qabtay |
| Collected Today | Lacagta Maanta La Qabtay |
| Customers Owe Us | Lacagta Macaamiisha Laga Sugayo |
| We Owe Suppliers | Deynta Aan Ku Leenahay Keenayaasha |
| Total Expenses | Wadarta Kharashaadka |
| This Month's Expenses | Kharashaadka Bishan |
| Current Account Balances | Haraaga Akoonnada |
| Warehouse Stock | Kaydka Bakhaarka |
| Diesel Stock | Kaydka Naaftada |
| Petrol Stock | Kaydka Basiinka |
| Pending Orders | Dalabyada Sugaya |
| Orders Today | Dalabyada Maanta |
| Today's Deliveries | Gaarsiinta Maanta |
| Sales & Collections | Iibka iyo Lacagaha La Qabtay |
| Fuel Sales | Iibka Shidaalka |
| Monthly | Bil kasta |
| Yearly | Sannad kasta |
| This Week | Toddobaadkan |
| This Month | Bishan |
| This Year | Sannadkan |
| No Data | Xog lama hayo |
| Profit Unavailable | Faa'iidada lama xisaabin karo |
| Cost Not Recorded | Qiimaha soo-iibsiga lama diiwaangelin |

### 05 — Customers & account (35 entries)

| Current / English label | Approved Somali label |
|---|---|
| Customer | Macmiil |
| New Customer | Macmiil Cusub |
| Add Customer | Ku dar Macmiil |
| Edit Customer | Wax ka beddel Macmiilka |
| Customer Name | Magaca Macmiilka |
| Customer Phone | Telefoonka Macmiilka |
| Phone Number | Lambarka Telefoonka |
| Location | Goobta |
| Address | Cinwaanka |
| Notes | Faahfaahin Kooban |
| Customer List | Liiska Macaamiisha |
| All Customers | Dhammaan Macaamiisha |
| Customer Code | Koodhka Macmiilka |
| Customer Status | Xaaladda Macmiilka |
| Customer on Hold | Macmiilka Waa La Hakiyey |
| Hold Customer | Haki Macmiilka |
| Unhold Customer | Ka qaad Hakinta |
| Customer Account | Xisaabta Macmiilka |
| Order Account | Xisaabta Dalabyada |
| Account Summary | Soo Koobidda Xisaabta |
| Total Sales | Wadarta Iibka |
| Total Paid | Wadarta La Bixiyey |
| Remaining Debt | Deynta Harsan |
| Customer Debt | Deynta Macmiilka |
| Outstanding Debt | Deynta Harsan |
| Total Due | Lacagta La Sugayo |
| Orders | Dalabyada |
| Payments | Lacagaha La Bixiyey |
| Payment History | Taariikhda Lacag-bixinta |
| Order Payment History | Lacagihii Dalabkan |
| Debt Payment | Bixinta Deynta |
| Old Debt | Deyntii Hore |
| No Debt | Deyn Ma Jirto |
| Paid in Full | Si Buuxda Loo Bixiyey |
| Statement PDF | Warbixinta Xisaabta PDF |

### 06 — Orders, fuel & delivery (56 entries)

| Current / English label | Approved Somali label |
|---|---|
| Order | Dalab |
| New Order | Dalab Cusub |
| Add Order | Samee Dalab |
| Order Details | Faahfaahinta Dalabka |
| Order Number | Lambarka Dalabka |
| Order Date | Taariikhda Dalabka |
| Delivery Date | Taariikhda Gaarsiinta |
| Requested Delivery Date | Taariikhda Gaarsiinta La Codsaday |
| Delivery Location | Goobta Gaarsiinta |
| Fuel Type | Nooca Shidaalka |
| Diesel | Naafto |
| Petrol | Basiin |
| Naafto | Naafto |
| Basiin | Basiin |
| Quantity | Tirada |
| Quantity (Fuusto) | Tirada (Fuusto) |
| Fuusto | Fuusto |
| 1 Fuusto = 240 liters | 1 Fuusto = 240 Litir |
| Unit Price | Qiimaha Fuustadii |
| Price per Fuusto | Qiimaha Fuustadii |
| Current Price | Qiimaha Hadda |
| Agreed Price | Qiimihii Lagu Heshiiyey |
| Subtotal | Wadarta Hore |
| Discount | Lacag-dhimis |
| Fixed Discount | Lacag-dhimis Go'an |
| Order Total | Wadarta Dalabka |
| Total | Wadarta |
| Paid Now | Hadda La Bixiyey |
| Paid Amount | Lacagta La Bixiyey |
| Amount Paid | Lacagta La Bixiyey |
| Remaining | Haraaga |
| Order Remaining | Haraaga Dalabka |
| Estimated Remaining | Haraaga La Filayo |
| Outstanding on Delivered Fuel | Deynta Shidaalka La Geeyey |
| Confirm Order | Xaqiiji Dalabka |
| Approve Discount | Oggolow Lacag-dhimista |
| Cancel Order | Jooji Dalabka |
| Order Invoice | Biilka Dalabka |
| Open Invoice | Fur Biilka |
| Draft | Qabyo |
| Confirmed | La Xaqiijiyey |
| Scheduled | La Qorsheeyey |
| In Progress | Wuu Socdaa |
| Partially Fulfilled | Qayb Ayaa La Geeyey |
| Fulfilled | Waa La Geeyey |
| Cancelled | Waa La Joojiyey |
| Pending Delivery | Gaarsiin Sugaya |
| Requested Quantity | Tiradii La Dalbaday |
| Accepted Quantity | Tiradii La Aqbalay |
| Delivered Quantity | Tiradii La Geeyey |
| Returned Quantity | Tiradii Soo Noqotay |
| Confirm Delivery | Xaqiiji Gaarsiinta |
| Delivery Confirmed | Gaarsiinta Waa La Xaqiijiyey |
| Delivery List | Liiska Gaarsiinta |
| Open Delivery PDF | Fur Liiska Gaarsiinta |
| No Orders Found | Dalab lama helin |

### 07 — Stock, receiving & suppliers (42 entries)

| Current / English label | Approved Somali label |
|---|---|
| Stock | Kaydka Shidaalka |
| Available Stock | Kaydka La Heli Karo |
| Stock Balance | Haraaga Kaydka |
| Stock Movement | Dhaqdhaqaaqa Kaydka |
| Stock History | Taariikhda Kaydka |
| Received Stock | Shidaalkii Soo Galay |
| Receive Stock | Soo Geli Shidaal |
| New Stock Receipt | Shidaal Soo Gelin Cusub |
| Stock Receipt | Diiwaanka Soo Gelinta |
| Receipt Number | Lambarka Diiwaanka |
| Receiving Date | Taariikhda Soo Gelinta |
| Warehouse | Bakhaar |
| In Transit | Waddada Ku Jira |
| Returned | Soo Noqday |
| Stock Adjustment | Sixidda Kaydka |
| Adjust Stock | Sax Kaydka |
| Adjustment Reason | Sababta Sixidda |
| Save Adjustment | Kaydi Sixidda |
| Purchase Cost | Qiimaha Soo-iibsiga |
| Unit Purchase Cost | Qiimaha Soo-iibsiga Fuustadii |
| Total Purchase Cost | Wadarta Soo-iibsiga |
| Supplier | Keenaha Shidaalka |
| Suppliers | Keenayaasha Shidaalka |
| Add Supplier | Ku dar Keene Shidaal |
| Supplier Name | Magaca Keenaha |
| Supplier Phone | Telefoonka Keenaha |
| Supplier Purchases | Shidaalkii Laga Soo Iibsaday |
| Supplier Payments | Lacagihii Keenaha La Siiyey |
| Supplier Debt | Deynta Keenaha |
| Supplier Outstanding | Deynta U Harsan Keenaha |
| Purchase Total | Wadarta Soo-iibsiga |
| Paid to Supplier | Keenaha La Siiyey |
| Supplier Paid Now | Hadda Keenaha La Siiyey |
| Supplier Remaining | Deynta U Harsan Keenaha |
| Pay Supplier | Bixi Deynta Keenaha |
| Record Supplier Payment | Diiwaangeli Lacag-siinta Keenaha |
| Purchase History | Taariikhda Soo-iibsiga |
| Payment History | Taariikhda Lacag-bixinta |
| Post Receipt | Xaqiiji Soo Gelinta |
| Posted | La Diiwaangeliyey |
| Not Tracked | Lama Diiwaangelin |
| Unknown Cost | Qiimaha Lama Oga |

### 08 — Customer payments, FIFO & reversals (35 entries)

| Current / English label | Approved Somali label |
|---|---|
| Record Payment | Diiwaangeli Lacag |
| Receive Payment | Qabso Lacag |
| Pay Debt | Bixi Deyn |
| Payment | Lacag-bixin |
| Payment Amount | Lacagta La Bixiyey |
| Payment Date | Taariikhda Lacag-bixinta |
| Received Amount | Lacagta La Qabtay |
| Money Received | Lacag Soo Gashay |
| Payment Method | Habka Lacag-bixinta |
| Receiving Account | Akoonka Lacagtu Soo Gashay |
| Paid From | Akoonka Laga Bixiyey |
| Reference | Tixraac |
| Transaction Reference | Tixraaca Wareejinta |
| Amount Due | Lacagta Lagu Leeyahay |
| Remaining After Payment | Deynta Ka Harsan |
| Pay Oldest Debt First | Deynta Ugu Horraysa Ka Jar |
| No Unpaid Delivered Orders | Deyn Shidaal La Geeyey Ma Jirto |
| Payment Receipt | Rasiidhka Lacagta |
| Open Receipt | Fur Rasiidhka |
| Receipt Number | Lambarka Rasiidhka |
| Payment Recorded | Lacagta Waa La Diiwaangeliyey |
| Reverse Payment | Ka Noqo Lacag-qabashada |
| Reverse | Ka Noqo |
| Reversal Reason | Sababta Ka Noqoshada |
| Confirm Reversal | Xaqiiji Ka Noqoshada |
| Reversed | Waa Laga Noqday |
| Reversal Record | Diiwaanka Ka Noqoshada |
| Original Payment | Lacag-qabashadii Hore |
| Correction | Sixid |
| Payment Already Reversed | Lacagtan Hore Ayaa Looga Noqday |
| No Overpayment Allowed | Lacagtani Way Ka Badan Tahay Deynta |
| No Payment Recorded | Weli Lacag Lama Bixin |
| Payment Is Linked To New Order | Lacagtan Waxay U Gaar Tahay Dalabkan |
| Payment Failed | Lacagta Lama Diiwaangelin |
| Payment Successful | Lacagta Waa La Diiwaangeliyey |

### 09 — Expenses (29 entries)

| Current / English label | Approved Somali label |
|---|---|
| Expenses | Kharashaadka |
| New Expense | Kharash Cusub |
| Add Expense | Diiwaangeli Kharash |
| Expense Details | Faahfaahinta Kharashka |
| Expense Category | Nooca Kharashka |
| Description | Sharaxaad |
| Amount | Lacagta |
| Expense Amount | Lacagta Kharashka |
| Expense Date | Taariikhda Kharashka |
| Paid From | Akoonka Laga Bixiyey |
| Save Expense | Kaydi Kharashka |
| Expense History | Diiwaanka Kharashaadka |
| Total Expenses | Wadarta Kharashaadka |
| Delivery Expense | Kharashka Gaarsiinta |
| Delivery | Gaarsiin |
| Fuel Transportation | Gaadiidka Shidaalka |
| Transport | Gaadiid |
| Rent | Kirada |
| Utilities | Adeegyada (Biyo/Koronto) |
| Salary / Wages | Mushahar iyo Gunno |
| Maintenance | Dayactir |
| Other | Kale |
| Outside Account | Lacag Ka Baxsan Akoonnada |
| Untracked Payment | Lacag Aan Akoon Lagu Xirin |
| Reverse Expense | Ka Noqo Kharashka |
| Reversal Reason | Sababta Ka Noqoshada |
| No Expenses Found | Kharash lama helin |
| Expense Saved | Kharashka Waa La Diiwaangeliyey |
| Expense Reversed | Kharashka Waa Laga Noqday |

### 10 — Financial accounts & money movements (42 entries)

| Current / English label | Approved Somali label |
|---|---|
| Financial Accounts | Akoonnada Lacagta |
| Accounts | Akoonnada |
| New Account | Akoon Cusub |
| Add Account | Ku dar Akoon |
| Edit Account | Wax ka beddel Akoonka |
| Account Name | Magaca Akoonka |
| Account Number | Lambarka Akoonka |
| Account Type | Nooca Akoonka |
| Payment Provider | Adeegga Lacagta |
| EVC Plus | EVC Plus |
| Somnet | Somnet |
| Cash | Lacag Caddaan ah |
| Bank | Bangi |
| Bank Transfer | Wareejin Bangi |
| Opening Balance | Haraagii Bilowga |
| Opening Balance Date | Taariikhda Haraagii Bilowga |
| Current Balance | Haraaga Hadda |
| Recorded Balance | Haraaga Diiwaangashan |
| Money In | Lacag Soo Gashay |
| Money Out | Lacag Baxday |
| Incoming | Soo gashay |
| Outgoing | Baxday |
| Transaction | Dhaqdhaqaaq Lacageed |
| Transaction History | Taariikhda Dhaqdhaqaaqa |
| Money In History | Lacagihii Soo Galay |
| Money Out History | Lacagihii Baxay |
| Transfer Money | Wareeji Lacag |
| Transfer From | Akoonka Laga Wareejinayo |
| Transfer To | Akoonka Loo Wareejinayo |
| Transfer Amount | Lacagta La Wareejinayo |
| Transfer Date | Taariikhda Wareejinta |
| Account Adjustment | Sixidda Haraaga |
| Balance Correction | Sixidda Haraaga |
| Reconcile Account | Hubi Haraaga |
| Outside/Not Tracked | Ka Baxsan Akoonnada |
| Unassigned Account | Akoon Lama Cayimin |
| Needs Review | Hubin Ayuu U Baahan Yahay |
| Account Statement | Warbixinta Akoonka |
| Accounts Summary | Soo Koobidda Akoonnada |
| Insufficient Balance | Haraaggu Kuma Filna |
| Balance Not Verified | Haraaga Lama Xaqiijin |
| This is a recorded balance, not live provider balance | Kani waa haraaga FuelDesk, ma aha kan tooska ah ee adeegga lacagta. |

### 11 — Reports, dates & filters (32 entries)

| Current / English label | Approved Somali label |
|---|---|
| Reports | Warbixinnada |
| Sales Report | Warbixinta Iibka |
| Customer Debt Report | Warbixinta Deymaha Macaamiisha |
| Supplier Debt Report | Warbixinta Deymaha Keenayaasha |
| Collections Report | Warbixinta Lacagaha La Qabtay |
| Stock Report | Warbixinta Kaydka |
| Expenses Report | Warbixinta Kharashaadka |
| Accounts Report | Warbixinta Akoonnada |
| Financial Summary | Soo Koobidda Lacagaha |
| From Date | Laga Bilaabo |
| To Date | Ilaa |
| Date | Taariikh |
| Today | Maanta |
| Yesterday | Shalay |
| Tomorrow | Berri |
| All Dates | Dhammaan Taariikhaha |
| Select Date | Dooro Taariikh |
| Select Customer | Dooro Macmiil |
| Select Status | Dooro Xaalad |
| All | Dhammaan |
| All Statuses | Dhammaan Xaaladaha |
| This Week | Toddobaadkan |
| This Month | Bishan |
| Last Month | Bishii Hore |
| This Year | Sannadkan |
| Custom Range | Xilli Aad Dooratay |
| Preview Report | Eeg Warbixinta |
| View Report | Fur Warbixinta |
| Generate Report | Diyaari Warbixinta |
| Export Report | Soo Dejiso Warbixinta |
| Print Report | Daabac Warbixinta |
| No Results | Wax natiijo ah lama helin |

### 12 — Settings, branding & documents (24 entries)

| Current / English label | Approved Somali label |
|---|---|
| Settings | Dejinta |
| General Settings | Dejinta Guud |
| Business Information | Xogta Ganacsiga |
| Company Name | Magaca Shirkadda |
| Company Address | Cinwaanka Shirkadda |
| Company Phone | Telefoonka Shirkadda |
| Company Email | Iimaylka Shirkadda |
| Logo | Astaanta Shirkadda |
| Upload Logo | Soo geli Astaanta |
| Footer | Qoraalka Hoose |
| Document Settings | Dejinta Dukumentiyada |
| Invoice Settings | Dejinta Biillada |
| Receipt Settings | Dejinta Rasiidhada |
| Currency | Nooca Lacagta |
| Time Zone | Aagga Waqtiga |
| Language | Luqadda |
| Somali | Af-Soomaali |
| English | Ingiriisi |
| Change Language | Beddel Luqadda |
| Users & Permissions | Isticmaaleyaasha iyo Ogolaanshaha |
| Audit Log | Diiwaanka Hawlaha |
| System History | Taariikhda Nidaamka |
| Business Name | Magaca Ganacsiga |
| Save Settings | Kaydi Dejinta |

### 13 — Printable PDF & invoice headings (27 entries)

| Current / English label | Approved Somali label |
|---|---|
| ORDER INVOICE | BIILKA DALABKA |
| PAYMENT RECEIPT | RASIIDHKA LACAG-BIXINTA |
| CUSTOMER STATEMENT | WARBIXINTA XISAABTA MACMIILKA |
| DELIVERY LIST | LIISKA GAARSIINTA |
| SUPPLIER PAYMENT RECEIPT | RASIIDHKA LACAG-SIINTA KEENAHA |
| CUSTOMER INFORMATION | XOGTA MACMIILKA |
| ORDER INFORMATION | XOGTA DALABKA |
| INVOICE NUMBER | LAMBARKA BIILKA |
| RECEIPT NUMBER | LAMBARKA RASIIDHKA |
| ITEM | SHAYGA |
| FUEL TYPE | NOOCA SHIDAALKA |
| QUANTITY | TIRADA |
| UNIT PRICE | QIIMAHA FUUSTADII |
| AMOUNT | LACAGTA |
| SUBTOTAL | WADARTA HORE |
| DISCOUNT | LACAG-DHIMIS |
| TOTAL | WADARTA |
| PAID AMOUNT | LACAGTA LA BIXIYEY |
| REMAINING | HARAAGA |
| ORDER PENDING DELIVERY | DALABKA WELI LAMA GEYN |
| NOTES | FIIRO GAAR AH |
| PREPARED BY | DIYAARIYE |
| RECEIVED BY | QAATAHA |
| CUSTOMER SIGNATURE | SAXIIXA MACMIILKA |
| DATE | TAARIIKH |
| THANK YOU FOR YOUR BUSINESS | WAAD KU MAHADSAN TAHAY GANACSIGAAGA |
| REVERSED | WAA LAGA NOQDAY |

### 14 — Notifications, validation & empty states (37 entries)

| Current / English label | Approved Somali label |
|---|---|
| Loading... | Waa la soo rarayaa… |
| Saving... | Waa la kaydinayaa… |
| Submitting... | Waa la gudbinayaa… |
| Processing... | Waa la fulinayaa… |
| Please wait | Fadlan sug |
| Saved successfully | Si guul leh ayaa loo kaydiyey |
| Updated successfully | Isbeddellada waa la kaydiyey |
| Deleted successfully | Waa la tirtiray |
| Failed to load data | Xogta lama soo rari karin |
| Failed to save | Lama kaydin; mar kale isku day |
| Something went wrong | Cilad ayaa dhacday; mar kale isku day |
| Please fill required fields | Buuxi meelaha khasabka ah |
| Required field | Meeshan waa khasab |
| Invalid amount | Geli lacag sax ah |
| Amount must be greater than zero | Lacagtu waa inay ka badan tahay eber |
| Invalid date | Geli taariikh sax ah |
| Please select a customer | Dooro macmiil |
| Please select an account | Dooro akoon |
| Please select fuel type | Dooro nooca shidaalka |
| Please enter whole Fuusto | Geli tiro fuusto oo dhan |
| Not enough stock | Shidaalka kaydka kuma filna |
| Discount approval required | Lacag-dhimistu waxay sugaysaa oggolaansho |
| Owner approval required | Oggolaanshaha milkiilaha ayaa loo baahan yahay |
| Are you sure? | Ma hubtaa? |
| Confirm Action | Xaqiiji Hawsha |
| Cannot undo this action | Hawshan si toos ah loogama noqon karo |
| Permission denied | Uma lihid ogolaansho |
| Session expired | Waqtigii gelitaanka ayaa dhammaaday; mar kale gal |
| No records found | Wax diiwaan ah lama helin |
| No customers found | Macmiil lama helin |
| No orders found | Dalab lama helin |
| No transactions found | Dhaqdhaqaaq lacageed lama helin |
| No payments recorded | Lacag weli lama diiwaangelin |
| Showing results | Natiijooyinka la helay |
| Already processed | Hawshan hore ayaa loo fuliyey |
| Duplicate request | Codsigan hore ayaa loo fuliyey |
| Network error | Xiriirka internetka ayaa go'ay; mar kale isku day |

### 15 — Table columns & pagination (28 entries)

| Current / English label | Approved Somali label |
|---|---|
| Number | Lambar |
| Reference | Tixraac |
| Date | Taariikh |
| Name | Magac |
| Phone | Telefoon |
| Fuel | Shidaal |
| Fuusto | Fuusto |
| Customer | Macmiil |
| Supplier | Keene Shidaal |
| Status | Xaalad |
| Amount | Lacag |
| Total | Wadarta |
| Paid | La Bixiyey |
| Remaining | Haraaga |
| Balance | Haraaga |
| Method | Habka |
| Account | Akoon |
| Category | Nooca |
| Description | Sharaxaad |
| Created By | Diiwaangeliyey |
| Last Updated | Markii Ugu Dambaysay La Beddelay |
| First | Ugu Horreeya |
| Last | Ugu Dambeeya |
| Page | Bogga |
| Rows per page | Safaf boggiiba |
| Next Page | Bogga Xiga |
| Previous Page | Bogga Hore |
| Results | Natiijooyin |

## Do not translate actual codes / do not misuse statuses

**Never change these internal identifiers:** `OWNER`, `OFFICE_EMPLOYEE`, `ACTIVE`, `HOLD`, `DRAFT`, `CONFIRMED`, `SCHEDULED`, `IN_PROGRESS`, `PARTIALLY_FULFILLED`, `FULFILLED`, `CANCELLED`, `EVC_PLUS`, `CASH`, `BANK_TRANSFER`, `EDAHAB`, plus route names and database keys. Translate only their **visible labels** via centralized presentation mappings.

**Order status:** `DRAFT` → Qabyo; `CONFIRMED` → La Xaqiijiyey; `SCHEDULED` → La Qorsheeyey; `IN_PROGRESS` → Wuu Socdaa; `PARTIALLY_FULFILLED` → Qayb Ayaa La Geeyey; `FULFILLED` → Waa La Geeyey; `CANCELLED` → Waa La Joojiyey.  
**Customer status:** `ACTIVE` → Shaqaynaya; `HOLD` → La Hakiyey; `INACTIVE` → Aan shaqaynayn.  
**Payment status:** posted → La Diiwaangeliyey; reversed → Waa Laga Noqday; pending → Sugaya.  
**Supplier purchase and expenses:** pending → Sugaya; paid → La Bixiyey; partial → Qayb Ayaa La Bixiyey; reversed → Waa Laga Noqday.  
**Transaction movement:** Money In → Lacag Soo Gashay; Money Out → Lacag Baxday; Transfer → Wareejin; Correction → Sixid.

## Critical content examples

**Customer account, delivered orders**  
`Wadarta iibka: $740.00` · `Wadarta la bixiyey: $270.00` · `Deynta harsan: $470.00`  
`Dalab ORD-001 · 6 Fuusto Naafto · Wadarta $240.00 · La bixiyey $170.00 · Haraaga $70.00`.

**Order pending delivery**  
`Dalab ORD-002 · Wadarta $500.00 · Hadda la bixiyey $100.00 · Haraaga la filayo $400.00`  
`Weli lama geynin — haraagani weli ma aha deyn rasmi ah.`

**Supplier payable**  
`Wadarta soo-iibsiga: $4,000.00 · Keenaha la siiyey: $1,500.00 · Deynta keenaha u harsan: $2,500.00`.

**Expense + account**  
`Kharashka gaarsiinta: $40.00 · Waxaa laga bixiyey: EVC Plus · Kharashka waa la diiwaangeliyey.`

**Payment and receipt**  
`Macmiil: Axmed · Lacagta la qabtay: $200.00 · Akoonka: EVC Plus · Fur rasiidhka`.

**Owner reversal modal**  
Title `Ka noqo lacag-qabashada`; text `Ka noqoshadani waxay saxaysaa deynta macmiilka iyo haraaga akoonka. Diiwaankii hore wuu sii jirayaa.`; field `Sababta ka noqoshada` (required); CTA `Xaqiiji ka noqoshada`, secondary `Jooji`.

## Implementation instructions for Codex

1. Before editing UI, inspect **every** user-facing `.tsx/.ts` component, route, shared formatter, toast/error map, PDF/Excel exporter and E2E test; enumerate remaining English strings. Include any newly implemented V7.1 Suppliers/Expenses/Accounts routes, not just existing six pages.
2. Create a single canonical Somali localization source (e.g. typed `so.ts` dictionary with nested `nav`, `actions`, `customers`, `orders`, `stock`, `suppliers`, `expenses`, `accounts`, `reports`, `settings`, `pdf`, `statuses`, `validation`, `errors`). Prefer keyed constants/helpers and context parameters; **do not** run global search-and-replace blindly. Support parameterized messages (`${amount}`, dates, refs) and centralized display-name mapping.
3. Replace all English and mixed bilingual labels across 8 sidebar sections, all detail forms, dialogs, tables, charts, status badges, tooltips, accessibility strings, search input placeholders, the login screen, global header, settings, PDFs, Excel exported column headers, toasts and relevant API-error human messages.
4. Shorten button wording on mobile without reducing meaning or accessible labels; preserve existing layout, colors, icons, flow and logic. Review 320, 360, 390, 430, 768, 1024, 1440px widths. Check line wrapping, RTL accidental styling (Somali uses Latin **LTR**), PDF font glyph coverage, date overflow, abbreviations, aria-labels and print layout.
5. Regression check financial language is truthful: customer debt vs supplier payable, new-order Paid Now attribution, pending-order estimated balance, Money In vs sales, reversal vs refund, linked expenses vs account Money Out, actual book balance vs external provider. Confirm delivery list PDF still excludes ALL financial data.
6. Do not translate stored historical names/text, external receipt references or third-party errors unsafely. Translate the **presentation layer** only. Keep API identifiers unchanged to avoid migration and integration breaking changes.
7. Test user-facing scenarios and unit tests for status labels, money formatting, business dates and PDFs. Run typecheck, unit/integration tests, full production build, UI screenshot review. Report changed files, any untranslated strings (with reason), exact executed command results, and blockers. Do not deploy.

## Precedence statement

V7.1 remains authoritative for business logic, financial accounts, supplier debt, receipts and expenses. **V7.2 overrides V7.1 ONLY for user-visible language/copy and sidebar item names.** No business rules change.
