-- Additive only: retain all historical invoices, payments and stock records.
ALTER TABLE "Payment" ADD COLUMN "orderId" UUID;
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "WorkflowRequest" (
  "key" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRequest_pkey" PRIMARY KEY ("key")
);
