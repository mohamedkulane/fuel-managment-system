-- CreateEnum
CREATE TYPE "public"."SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."SupplierPurchaseStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."FinancialAccountType" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AccountOverdraftPolicy" AS ENUM ('UNSET', 'BLOCK_NEGATIVE', 'ALLOW_NEGATIVE');

-- CreateEnum
CREATE TYPE "public"."FinancialMovementDirection" AS ENUM ('MONEY_IN', 'MONEY_OUT');

-- CreateEnum
CREATE TYPE "public"."FinancialMovementKind" AS ENUM ('OPENING_BALANCE', 'CUSTOMER_PAYMENT', 'CUSTOMER_PAYMENT_REVERSAL', 'SUPPLIER_PAYMENT', 'SUPPLIER_PAYMENT_REVERSAL', 'EXPENSE', 'EXPENSE_REVERSAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "public"."ExpenseStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."AccountTransferStatus" AS ENUM ('POSTED', 'REVERSED');

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "accountMappedAt" TIMESTAMP(3),
ADD COLUMN     "accountMappedById" UUID,
ADD COLUMN     "financialAccountId" UUID;

-- AlterTable
ALTER TABLE "public"."TankerReceipt" ADD COLUMN     "supplierId" UUID;

-- CreateTable
CREATE TABLE "public"."Supplier" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" "public"."SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPurchase" (
    "id" UUID NOT NULL,
    "purchaseNo" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "quantityFuusto" DECIMAL(18,3) NOT NULL,
    "litersPerFuustoSnapshot" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(20,4) NOT NULL,
    "totalCost" DECIMAL(20,4) NOT NULL,
    "paidAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(20,4) NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."SupplierPurchaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialAccount" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."FinancialAccountType" NOT NULL,
    "identifierMasked" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "openingBalance" DECIMAL(20,4) NOT NULL,
    "openingBalanceAsOf" TIMESTAMP(3) NOT NULL,
    "currentBalance" DECIMAL(20,4) NOT NULL,
    "overdraftPolicy" "public"."AccountOverdraftPolicy" NOT NULL DEFAULT 'UNSET',
    "allowOfficePayments" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FinancialAccountMovement" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "public"."FinancialMovementDirection" NOT NULL,
    "kind" "public"."FinancialMovementKind" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "balanceAfter" DECIMAL(20,4) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAccountMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPayment" (
    "id" UUID NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "financialAccountId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "allocatedAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "idempotencyKey" TEXT NOT NULL,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPaymentAllocation" (
    "id" UUID NOT NULL,
    "supplierPaymentId" UUID NOT NULL,
    "supplierPurchaseId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SupplierPaymentReversal" (
    "id" UUID NOT NULL,
    "reversalNo" TEXT NOT NULL,
    "supplierPaymentId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" UUID NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPaymentReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessExpense" (
    "id" UUID NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "financialAccountId" UUID,
    "outsideTracked" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT,
    "notes" TEXT,
    "status" "public"."ExpenseStatus" NOT NULL DEFAULT 'POSTED',
    "idempotencyKey" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExpenseReversal" (
    "id" UUID NOT NULL,
    "reversalNo" TEXT NOT NULL,
    "expenseId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedById" UUID NOT NULL,
    "reversedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AccountTransfer" (
    "id" UUID NOT NULL,
    "transferNo" TEXT NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "status" "public"."AccountTransferStatus" NOT NULL DEFAULT 'POSTED',
    "idempotencyKey" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "public"."Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "public"."Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPurchase_purchaseNo_key" ON "public"."SupplierPurchase"("purchaseNo");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPurchase_receiptId_key" ON "public"."SupplierPurchase"("receiptId");

-- CreateIndex
CREATE INDEX "SupplierPurchase_supplierId_purchaseDate_idx" ON "public"."SupplierPurchase"("supplierId", "purchaseDate");

-- CreateIndex
CREATE INDEX "SupplierPurchase_status_idx" ON "public"."SupplierPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_code_key" ON "public"."FinancialAccount"("code");

-- CreateIndex
CREATE INDEX "FinancialAccount_active_name_idx" ON "public"."FinancialAccount"("active", "name");

-- CreateIndex
CREATE INDEX "FinancialAccountMovement_accountId_occurredAt_idx" ON "public"."FinancialAccountMovement"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinancialAccountMovement_sourceType_sourceId_idx" ON "public"."FinancialAccountMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccountMovement_accountId_sourceType_sourceId_kind_key" ON "public"."FinancialAccountMovement"("accountId", "sourceType", "sourceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_paymentNo_key" ON "public"."SupplierPayment"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_idempotencyKey_key" ON "public"."SupplierPayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_paymentDate_idx" ON "public"."SupplierPayment"("supplierId", "paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_financialAccountId_paymentDate_idx" ON "public"."SupplierPayment"("financialAccountId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentAllocation_supplierPaymentId_supplierPurchas_key" ON "public"."SupplierPaymentAllocation"("supplierPaymentId", "supplierPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentReversal_reversalNo_key" ON "public"."SupplierPaymentReversal"("reversalNo");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentReversal_supplierPaymentId_key" ON "public"."SupplierPaymentReversal"("supplierPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPaymentReversal_idempotencyKey_key" ON "public"."SupplierPaymentReversal"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessExpense_expenseNo_key" ON "public"."BusinessExpense"("expenseNo");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessExpense_idempotencyKey_key" ON "public"."BusinessExpense"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BusinessExpense_expenseDate_idx" ON "public"."BusinessExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "BusinessExpense_financialAccountId_expenseDate_idx" ON "public"."BusinessExpense"("financialAccountId", "expenseDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReversal_reversalNo_key" ON "public"."ExpenseReversal"("reversalNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReversal_expenseId_key" ON "public"."ExpenseReversal"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReversal_idempotencyKey_key" ON "public"."ExpenseReversal"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_transferNo_key" ON "public"."AccountTransfer"("transferNo");

-- CreateIndex
CREATE UNIQUE INDEX "AccountTransfer_idempotencyKey_key" ON "public"."AccountTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AccountTransfer_transferDate_idx" ON "public"."AccountTransfer"("transferDate");

-- CreateIndex
CREATE INDEX "Payment_financialAccountId_paymentDate_idx" ON "public"."Payment"("financialAccountId", "paymentDate");

-- CreateIndex
CREATE INDEX "TankerReceipt_supplierId_idx" ON "public"."TankerReceipt"("supplierId");

-- AddForeignKey
ALTER TABLE "public"."TankerReceipt" ADD CONSTRAINT "TankerReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_accountMappedById_fkey" FOREIGN KEY ("accountMappedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."TankerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccount" ADD CONSTRAINT "FinancialAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccountMovement" ADD CONSTRAINT "FinancialAccountMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccountMovement" ADD CONSTRAINT "FinancialAccountMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FinancialAccountMovement" ADD CONSTRAINT "FinancialAccountMovement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "public"."FinancialAccountMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPayment" ADD CONSTRAINT "SupplierPayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "public"."SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentAllocation" ADD CONSTRAINT "SupplierPaymentAllocation_supplierPurchaseId_fkey" FOREIGN KEY ("supplierPurchaseId") REFERENCES "public"."SupplierPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentReversal" ADD CONSTRAINT "SupplierPaymentReversal_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "public"."SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SupplierPaymentReversal" ADD CONSTRAINT "SupplierPaymentReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessExpense" ADD CONSTRAINT "BusinessExpense_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessExpense" ADD CONSTRAINT "BusinessExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExpenseReversal" ADD CONSTRAINT "ExpenseReversal_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "public"."BusinessExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExpenseReversal" ADD CONSTRAINT "ExpenseReversal_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AccountTransfer" ADD CONSTRAINT "AccountTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
