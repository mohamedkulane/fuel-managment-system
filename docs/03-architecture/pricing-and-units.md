# Fuel Units, Conversion and Price Versioning

## Canonical approach
- `FuelType`: `DIESEL`, `PETROL`.
- `SalesUnit`: owner-created code/display label such as `Fuusto Small`; **authoritative liter conversion belongs to `FuelUnitVersion`, not an editable SalesUnit field**. Multiple unit codes/sizes can coexist; do not assume sizes from labels.
- `FuelUnitVersion`: optional fuel-specific conversion with `effectiveFrom` for different fills/specifications; once transacted, version is not edited in-place.
- `TankerReceiptLine.actualLiters` always stores liters, independent of truck volume/container sales.
- `OrderLine.qtyUnits` x `orderLine.litersPerUnitSnapshot` = `qtyLitersSnapshot` (round/quantize to permitted stock precision only once). Invoice snapshots both sale unit and ratio.

## Pricing
One `PriceVersion` for each `(fuelType, salesUnit, effective period)`, with `amountPerUnit NUMERIC(20,4)`, `effectiveFromUtc`, `effectiveToUtc nullable`, `reason`, `authorId`. Historical versions are immutable; a price update closes old effective interval and inserts a new version. Validate non-overlap transactionally. DB helper constraint via Postgres exclusion index or serialization/advisory lock because Prisma's schema alone may not express temporal overlaps.

During `confirmOrder`, within server transaction: choose price valid at confirmation instant (or approved negotiated override); assert chosen unit conversion valid; snapshot `unitPrice`, `currency`, `units`, `litersPerUnit`, `priceVersionId` onto confirmed order line. Subsequent price list edits cannot modify snapshots or existing invoices.

### Example (not a system default)
Suppose owner configures a **20L fuusto**, and confirms an order for 20 at `$120 per fuusto`: 400 liters planned and `$2,400` estimated. Customer accepts 18: 360 liters actually sold, invoice = `$2,160`; other 40 liters are explicitly tracked physically.

### Decimals
- Liters: `NUMERIC(18,3)` or measurement-policy approved precision.
- Liters per container: `NUMERIC(18,6)`; quantities of containers `NUMERIC(18,3)` (UI may require whole numbers).
- Unit prices: `NUMERIC(20,4)` for flexibility; invoice line totals `NUMERIC(20,2)` rounded using documented half-up policy; sums in decimal only.
- API represent decimal quantities/money as strings. Frontend parsing is strictly validation/display; authoritative math server-side.

### Test boundaries
Historical price snapshots, time boundary at effective instant, overlapping versions denied, no 200/220L hardcode, owner-set conversion required, conversion change doesn't alter history, both fuels separately priced, override reason logged and owner-approved.
