-- AlterEnum
ALTER TYPE "public"."FinancialMovementKind" ADD VALUE 'CUSTOMER_REFUND';

-- CreateTable
CREATE TABLE "public"."CustomerRefund" (
    "id" UUID NOT NULL,
    "refundNo" TEXT NOT NULL,
    "orderId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "financialAccountId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "refundDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRefund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_refundNo_key" ON "public"."CustomerRefund"("refundNo");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRefund_idempotencyKey_key" ON "public"."CustomerRefund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CustomerRefund_orderId_idx" ON "public"."CustomerRefund"("orderId");

-- CreateIndex
CREATE INDEX "CustomerRefund_customerId_idx" ON "public"."CustomerRefund"("customerId");

-- CreateIndex
CREATE INDEX "CustomerRefund_financialAccountId_idx" ON "public"."CustomerRefund"("financialAccountId");

-- AddForeignKey
ALTER TABLE "public"."CustomerRefund" ADD CONSTRAINT "CustomerRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerRefund" ADD CONSTRAINT "CustomerRefund_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerRefund" ADD CONSTRAINT "CustomerRefund_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerRefund" ADD CONSTRAINT "CustomerRefund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
