-- Additive migration for the confirmed 240 L/Fuusto stock-purchase workflow,
-- optional purchase costs, and fixed order-level discounts.

UPDATE "FuelUnitVersion"
SET "litersPerUnit" = 240
WHERE "litersPerUnit" <> 240;

ALTER TABLE "FuelUnitVersion"
  ADD CONSTRAINT "FuelUnitVersion_litersPerUnit_fixed_240"
    CHECK ("litersPerUnit" = 240);

ALTER TABLE "TankerReceiptLine"
  ADD COLUMN "quantityFuusto" DECIMAL(18,3),
  ADD COLUMN "litersPerFuustoSnapshot" DECIMAL(18,6),
  ADD COLUMN "totalPurchaseCost" DECIMAL(20,4);

UPDATE "TankerReceiptLine"
SET
  "quantityFuusto" = "actualLiters" / 240,
  "litersPerFuustoSnapshot" = 240,
  "totalPurchaseCost" = CASE
    WHEN "unitPurchaseCost" IS NULL THEN NULL
    ELSE "actualLiters" * "unitPurchaseCost"
  END,
  "unitPurchaseCost" = CASE
    WHEN "unitPurchaseCost" IS NULL THEN NULL
    ELSE "unitPurchaseCost" * 240
  END;

ALTER TABLE "SalesOrder"
  ADD COLUMN "subtotal" DECIMAL(20,4),
  ADD COLUMN "fixedDiscountAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  ADD COLUMN "totalAmount" DECIMAL(20,4),
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountApprovedById" UUID,
  ADD COLUMN "discountApprovedAt" TIMESTAMP(3);

ALTER TABLE "Invoice"
  ADD COLUMN "discountAmount" DECIMAL(20,4) NOT NULL DEFAULT 0;

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_discountApprovedById_fkey"
  FOREIGN KEY ("discountApprovedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TankerReceiptLine"
  ADD CONSTRAINT "TankerReceiptLine_quantityFuusto_positive"
    CHECK ("quantityFuusto" IS NULL OR "quantityFuusto" > 0),
  ADD CONSTRAINT "TankerReceiptLine_litersPerFuustoSnapshot_240"
    CHECK ("litersPerFuustoSnapshot" IS NULL OR "litersPerFuustoSnapshot" = 240),
  ADD CONSTRAINT "TankerReceiptLine_totalPurchaseCost_nonnegative"
    CHECK ("totalPurchaseCost" IS NULL OR "totalPurchaseCost" >= 0);

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_fixedDiscountAmount_nonnegative"
    CHECK ("fixedDiscountAmount" >= 0),
  ADD CONSTRAINT "SalesOrder_fixedDiscountAmount_not_above_subtotal"
    CHECK ("subtotal" IS NULL OR "fixedDiscountAmount" <= "subtotal");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_discountAmount_nonnegative"
    CHECK ("discountAmount" >= 0),
  ADD CONSTRAINT "Invoice_discountAmount_not_above_subtotal"
    CHECK ("discountAmount" <= "subtotal");

CREATE INDEX "SalesOrder_discountApprovedById_idx"
  ON "SalesOrder"("discountApprovedById");

UPDATE "DeliveryConfirmation"
SET "idempotencyKey" = 'legacy-' || "id"::text
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "DeliveryConfirmation"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

ALTER TABLE "DeliverySheetLine"
  ALTER COLUMN "orderNoSnapshot" DROP DEFAULT;
