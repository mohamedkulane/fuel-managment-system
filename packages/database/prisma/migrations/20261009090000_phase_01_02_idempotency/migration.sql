ALTER TABLE "public"."TankerReceipt"
  ADD COLUMN "postIdempotencyKey" TEXT;

ALTER TABLE "public"."SalesOrder"
  ADD COLUMN "confirmationIdempotencyKey" TEXT;

ALTER TABLE "public"."Dispatch"
  ADD COLUMN "postIdempotencyKey" TEXT;

ALTER TABLE "public"."DeliveryConfirmation"
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "TankerReceipt_postIdempotencyKey_key"
  ON "public"."TankerReceipt"("postIdempotencyKey");
CREATE UNIQUE INDEX "SalesOrder_confirmationIdempotencyKey_key"
  ON "public"."SalesOrder"("confirmationIdempotencyKey");
CREATE UNIQUE INDEX "Dispatch_idempotencyKey_key"
  ON "public"."Dispatch"("idempotencyKey");
CREATE UNIQUE INDEX "Dispatch_postIdempotencyKey_key"
  ON "public"."Dispatch"("postIdempotencyKey");
CREATE UNIQUE INDEX "DeliveryConfirmation_idempotencyKey_key"
  ON "public"."DeliveryConfirmation"("idempotencyKey");
