# Business Acceptance Scenarios (Executable Expectations)

**A. Changing price with old debt.** Customer Ahmed confirms 5 fuusto diesel at $100 each on day 1 and actually accepts all 5 => $500 invoice. Next day owner price increases to $120; Ahmed confirms and accepts 3 more => $360 invoice. Payment $200 against oldest invoice => posted outstanding **$660**. Neither old order, old invoice nor past receipt changes with later price change.

**B. Credit and multiple payments.** Customer owes $800 and owner has not blocked account. New $300 confirmed/accepted sale adds debt => $1,100. Receipts of $100, $200 and $150 are posted => balance **$650**; all three receipts visible with allocations. Customer may still place another order unless configured policy prevents it.

**C. 20 ordered / 18 accepted.** A confirmed order for 20 fuusto at $120/each is scheduled. A delivery sheet shows 20, with **no unit price**. If 20 are physically dispatched, warehouse decreases by 20 containers' liter equivalent and transit increases by same. Customer accepts 18. Office records 18 accepted, and disposition of 2 (e.g. two returned to warehouse); invoice equals **$2,160**, not $2,400. Dispatched 20 = accepted 18 + returned 2 (+ other unresolved amounts, if any). The order remains traceable to original 20; no silent rewrite to 18.

**D. Price change while order pending.** A draft order is not authoritative. On confirm, lock unit price explicitly shown for customer approval. Changing master price tomorrow never changes this confirmed line, including an installment sale or later delivery. An owner-approved price amendment, if ever allowed, creates an audited revision *before invoice posting*.

**E. Two fuels and multiple booyado.** Receive measured 10,000 L diesel from tanker A, 15,000 L petrol from tanker B, 5,000 L diesel from tanker C. Physical total: diesel 15,000 L, petrol 15,000 L, independently reconciled; no assumption about tanker capacities or number of fuusto per tanker.

**F. Delivery manifest protection.** OFFICE selects a day and exports a PDF. Visible page, generated DTO, HTML if used and PDF extracted text contain only date, reference, customer, phone, address, fuel, scheduled quantity, instructions and optional acknowledgment blanks. No `$`, `price`, `debt`, `amount`, `cost`, `paid`, `profit` or finance IDs in payload/document metadata. Separate finance endpoints still have role checks.

**G. Duplicate request safety.** Double-click payment save or retry POST with same idempotency key produces one receipt and one allocation set. Two employees dispatching the same stock concurrently cannot cause negative available liters.

**H. Undo a mistake.** A posted receipt made to wrong customer is not deleted; OWNER authorizes a reversal with reason and an audit trail, then reposts correctly. Existing customer statement shows the original, reversal and correction.

**I. Stock and payment confidentiality.** OFFICE sees enough customer outstanding amounts to collect; cannot retrieve owner-only unit purchase costs or margin via UI, URLs, report endpoints or altered REST requests. No separate driver credentials exist.

**J. Reporting.** Filter debt aging by customer/date and export Excel/PDF: row sums match posted finance ledger; quantity totals match accepted delivery; generated date and report filter are displayed.
