-- Preserve every historical row. If duplicates already exist, this migration fails
-- for explicit owner review instead of deleting or merging financial history.
ALTER TABLE "PaymentReversal" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "PaymentReversal"
SET "idempotencyKey" = 'legacy-reversal:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "PaymentReversal" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "PaymentReversal_paymentId_key" ON "PaymentReversal"("paymentId");
CREATE UNIQUE INDEX "PaymentReversal_idempotencyKey_key" ON "PaymentReversal"("idempotencyKey");
