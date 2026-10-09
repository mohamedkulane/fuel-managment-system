CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "public"."TankerReceiptLine"
  ADD CONSTRAINT "TankerReceiptLine_actualLiters_positive" CHECK ("actualLiters" > 0),
  ADD CONSTRAINT "TankerReceiptLine_expectedLiters_positive" CHECK ("expectedLiters" IS NULL OR "expectedLiters" > 0),
  ADD CONSTRAINT "TankerReceiptLine_unitPurchaseCost_nonnegative" CHECK ("unitPurchaseCost" IS NULL OR "unitPurchaseCost" >= 0);

ALTER TABLE "public"."FuelUnitVersion"
  ADD CONSTRAINT "FuelUnitVersion_litersPerUnit_positive" CHECK ("litersPerUnit" > 0),
  ADD CONSTRAINT "FuelUnitVersion_effective_period_no_overlap"
  EXCLUDE USING gist (
    "fuelId" WITH =,
    "salesUnitId" WITH =,
    tsrange("effectiveFromUtc", "effectiveToUtc", '[)') WITH &&
  );

ALTER TABLE "public"."PriceVersion"
  ADD CONSTRAINT "PriceVersion_unitPrice_positive" CHECK ("unitPrice" > 0),
  ADD CONSTRAINT "PriceVersion_effective_period_no_overlap"
  EXCLUDE USING gist (
    "fuelId" WITH =,
    "salesUnitId" WITH =,
    tsrange("effectiveFromUtc", "effectiveToUtc", '[)') WITH &&
  );

ALTER TABLE "public"."StockBalance"
  ADD CONSTRAINT "StockBalance_balanceLiters_nonnegative" CHECK ("balanceLiters" >= 0);

ALTER TABLE "public"."SalesOrderLine"
  ADD CONSTRAINT "SalesOrderLine_requestedUnits_positive" CHECK ("requestedUnits" > 0);

ALTER TABLE "public"."DispatchLine"
  ADD CONSTRAINT "DispatchLine_dispatchedUnits_nonnegative" CHECK ("dispatchedUnits" >= 0),
  ADD CONSTRAINT "DispatchLine_dispatchedLiters_nonnegative" CHECK ("dispatchedLiters" >= 0),
  ADD CONSTRAINT "DispatchLine_litersPerUnitSnapshot_positive" CHECK ("litersPerUnitSnapshot" > 0);

ALTER TABLE "public"."DeliveryConfirmationLine"
  ADD CONSTRAINT "DeliveryConfirmationLine_acceptedUnits_nonnegative" CHECK ("acceptedUnits" >= 0),
  ADD CONSTRAINT "DeliveryConfirmationLine_acceptedLiters_nonnegative" CHECK ("acceptedLiters" >= 0),
  ADD CONSTRAINT "DeliveryConfirmationLine_returnedLiters_nonnegative" CHECK ("physicalReturnedLiters" >= 0);

ALTER TABLE "public"."InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_signedDeltaLiters_nonzero" CHECK ("signedDeltaLiters" <> 0);
