-- AlterEnum
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'SOMNET';

-- DropIndex
DROP INDEX "public"."SupplierPurchase_receiptId_key";

-- AlterTable
ALTER TABLE "public"."TankerReceipt" ADD COLUMN     "paidNow" DECIMAL(20,4) NOT NULL DEFAULT 0,
ADD COLUMN     "payingAccountId" UUID;

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "accountMappingMode" TEXT,
ADD COLUMN     "receiptSnapshot" JSONB;

-- AlterTable
ALTER TABLE "public"."SupplierPurchase" ADD COLUMN     "receiptLineId" UUID;

-- AlterTable
ALTER TABLE "public"."FinancialAccount" ADD COLUMN     "paymentMethod" "public"."PaymentMethod";

-- AlterTable
ALTER TABLE "public"."AccountTransfer" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPurchase_receiptLineId_key" ON "public"."SupplierPurchase"("receiptLineId");
