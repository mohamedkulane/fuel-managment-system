-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('OWNER', 'OFFICE_EMPLOYEE');

-- CreateEnum
CREATE TYPE "public"."FuelCode" AS ENUM ('DIESEL', 'PETROL');

-- CreateEnum
CREATE TYPE "public"."CustomerStatus" AS ENUM ('ACTIVE', 'HOLD', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ReceiptStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'SCHEDULED', 'IN_PROGRESS', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DeliverySheetStatus" AS ENUM ('PREPARED', 'PRINTED', 'DISPATCHED', 'PARTIALLY_RECONCILED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "public"."DispatchStatus" AS ENUM ('PREPARED', 'POSTED', 'PARTIALLY_RECONCILED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "public"."CommercialDisposition" AS ENUM ('NONE', 'CANCEL_REMAINDER', 'BACKORDER_REMAINDER');

-- CreateEnum
CREATE TYPE "public"."Location" AS ENUM ('WAREHOUSE', 'IN_TRANSIT');

-- CreateEnum
CREATE TYPE "public"."MovementType" AS ENUM ('RECEIPT', 'DISPATCH', 'ACCEPTED', 'RETURN', 'ADJUSTMENT', 'REVERSAL');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeRedacted" JSONB,
    "afterRedacted" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FuelType" (
    "id" UUID NOT NULL,
    "code" "public"."FuelCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FuelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesUnit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SalesUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FuelUnitVersion" (
    "id" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "salesUnitId" UUID NOT NULL,
    "litersPerUnit" DECIMAL(18,6) NOT NULL,
    "effectiveFromUtc" TIMESTAMP(3) NOT NULL,
    "effectiveToUtc" TIMESTAMP(3),
    "createdById" UUID NOT NULL,

    CONSTRAINT "FuelUnitVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PriceVersion" (
    "id" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "salesUnitId" UUID NOT NULL,
    "unitPrice" DECIMAL(20,4) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFromUtc" TIMESTAMP(3) NOT NULL,
    "effectiveToUtc" TIMESTAMP(3),
    "reason" TEXT,
    "createdById" UUID NOT NULL,

    CONSTRAINT "PriceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Customer" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryPhone" TEXT,
    "otherPhone" TEXT,
    "notes" TEXT,
    "status" "public"."CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditLimit" DECIMAL(20,2),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAddress" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "addressText" TEXT NOT NULL,
    "district" TEXT,
    "city" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TankerReceipt" (
    "id" UUID NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "tankerReference" TEXT,
    "arrivedAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TankerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TankerReceiptLine" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "expectedLiters" DECIMAL(18,3),
    "actualLiters" DECIMAL(18,3) NOT NULL,
    "unitPurchaseCost" DECIMAL(20,4),

    CONSTRAINT "TankerReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrder" (
    "id" UUID NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "requestedDeliveryDate" TIMESTAMP(3),
    "addressSnapshot" TEXT NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "confirmedById" UUID,
    "confirmedAt" TIMESTAMP(3),
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrderLine" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "salesUnitId" UUID NOT NULL,
    "requestedUnits" DECIMAL(18,3) NOT NULL,
    "conversionVersionId" UUID,
    "litersPerUnitSnapshot" DECIMAL(18,6),
    "requestedLitersSnapshot" DECIMAL(18,3),
    "priceVersionId" UUID,
    "unitPriceSnapshot" DECIMAL(20,4),
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "confirmedAt" TIMESTAMP(3),
    "orderIdempotencyKey" TEXT,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineId" UUID,
    "kind" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliverySheet" (
    "id" UUID NOT NULL,
    "sheetNo" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "status" "public"."DeliverySheetStatus" NOT NULL DEFAULT 'PREPARED',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliverySheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliverySheetLine" (
    "id" UUID NOT NULL,
    "sheetId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "scheduledUnits" DECIMAL(18,3) NOT NULL,
    "displayCustomerNameSnapshot" TEXT NOT NULL,
    "phoneSnapshot" TEXT,
    "addressSnapshot" TEXT NOT NULL,
    "fuelLabelSnapshot" TEXT NOT NULL,
    "instructions" TEXT,

    CONSTRAINT "DeliverySheetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dispatch" (
    "id" UUID NOT NULL,
    "dispatchNo" TEXT NOT NULL,
    "deliverySheetId" UUID,
    "status" "public"."DispatchStatus" NOT NULL DEFAULT 'PREPARED',
    "dispatchedAt" TIMESTAMP(3),
    "postedById" UUID,
    "postedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "notes" TEXT,

    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DispatchLine" (
    "id" UUID NOT NULL,
    "dispatchId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "sheetLineId" UUID,
    "dispatchedUnits" DECIMAL(18,3) NOT NULL,
    "dispatchedLiters" DECIMAL(18,3) NOT NULL,
    "litersPerUnitSnapshot" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "DispatchLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryConfirmation" (
    "id" UUID NOT NULL,
    "confirmationNo" TEXT NOT NULL,
    "dispatchId" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" UUID NOT NULL,
    "notes" TEXT,

    CONSTRAINT "DeliveryConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryConfirmationLine" (
    "id" UUID NOT NULL,
    "confirmationId" UUID NOT NULL,
    "dispatchLineId" UUID NOT NULL,
    "acceptedUnits" DECIMAL(18,3) NOT NULL,
    "acceptedLiters" DECIMAL(18,3) NOT NULL,
    "physicalReturnedLiters" DECIMAL(18,3) NOT NULL,
    "commercialDisposition" "public"."CommercialDisposition" NOT NULL DEFAULT 'NONE',
    "discrepancyReason" TEXT,
    "billingSourceKey" TEXT NOT NULL,

    CONSTRAINT "DeliveryConfirmationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InventoryMovement" (
    "id" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "location" "public"."Location" NOT NULL,
    "signedDeltaLiters" DECIMAL(18,3) NOT NULL,
    "eventType" "public"."MovementType" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceLineId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID NOT NULL,
    "reversalOfId" TEXT,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockBalance" (
    "id" UUID NOT NULL,
    "fuelId" UUID NOT NULL,
    "location" "public"."Location" NOT NULL,
    "balanceLiters" DECIMAL(18,3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "public"."Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "public"."Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "public"."AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FuelType_code_key" ON "public"."FuelType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SalesUnit_code_key" ON "public"."SalesUnit"("code");

-- CreateIndex
CREATE INDEX "FuelUnitVersion_fuelId_salesUnitId_effectiveFromUtc_idx" ON "public"."FuelUnitVersion"("fuelId", "salesUnitId", "effectiveFromUtc");

-- CreateIndex
CREATE INDEX "PriceVersion_fuelId_salesUnitId_effectiveFromUtc_idx" ON "public"."PriceVersion"("fuelId", "salesUnitId", "effectiveFromUtc");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "public"."Customer"("code");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "public"."Customer"("name");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "public"."CustomerAddress"("customerId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "TankerReceipt_receiptNo_key" ON "public"."TankerReceipt"("receiptNo");

-- CreateIndex
CREATE INDEX "TankerReceipt_arrivedAt_idx" ON "public"."TankerReceipt"("arrivedAt");

-- CreateIndex
CREATE INDEX "TankerReceiptLine_fuelId_idx" ON "public"."TankerReceiptLine"("fuelId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "public"."SalesOrder"("orderNo");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_orderDate_idx" ON "public"."SalesOrder"("customerId", "orderDate");

-- CreateIndex
CREATE INDEX "SalesOrderLine_orderId_idx" ON "public"."SalesOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_occurredAt_idx" ON "public"."OrderEvent"("orderId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverySheet_sheetNo_key" ON "public"."DeliverySheet"("sheetNo");

-- CreateIndex
CREATE INDEX "DeliverySheet_serviceDate_createdAt_idx" ON "public"."DeliverySheet"("serviceDate", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliverySheetLine_sheetId_orderLineId_key" ON "public"."DeliverySheetLine"("sheetId", "orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatch_dispatchNo_key" ON "public"."Dispatch"("dispatchNo");

-- CreateIndex
CREATE INDEX "Dispatch_deliverySheetId_idx" ON "public"."Dispatch"("deliverySheetId");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchLine_dispatchId_orderLineId_key" ON "public"."DispatchLine"("dispatchId", "orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryConfirmation_confirmationNo_key" ON "public"."DeliveryConfirmation"("confirmationNo");

-- CreateIndex
CREATE INDEX "DeliveryConfirmation_dispatchId_confirmedAt_idx" ON "public"."DeliveryConfirmation"("dispatchId", "confirmedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryConfirmationLine_billingSourceKey_key" ON "public"."DeliveryConfirmationLine"("billingSourceKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_fuelId_location_occurredAt_idx" ON "public"."InventoryMovement"("fuelId", "location", "occurredAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_sourceType_sourceId_idx" ON "public"."InventoryMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_sourceType_sourceLineId_eventType_locatio_key" ON "public"."InventoryMovement"("sourceType", "sourceLineId", "eventType", "location");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_fuelId_location_key" ON "public"."StockBalance"("fuelId", "location");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FuelUnitVersion" ADD CONSTRAINT "FuelUnitVersion_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FuelUnitVersion" ADD CONSTRAINT "FuelUnitVersion_salesUnitId_fkey" FOREIGN KEY ("salesUnitId") REFERENCES "public"."SalesUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FuelUnitVersion" ADD CONSTRAINT "FuelUnitVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceVersion" ADD CONSTRAINT "PriceVersion_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceVersion" ADD CONSTRAINT "PriceVersion_salesUnitId_fkey" FOREIGN KEY ("salesUnitId") REFERENCES "public"."SalesUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceVersion" ADD CONSTRAINT "PriceVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TankerReceipt" ADD CONSTRAINT "TankerReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TankerReceipt" ADD CONSTRAINT "TankerReceipt_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TankerReceiptLine" ADD CONSTRAINT "TankerReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."TankerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TankerReceiptLine" ADD CONSTRAINT "TankerReceiptLine_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesUnitId_fkey" FOREIGN KEY ("salesUnitId") REFERENCES "public"."SalesUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_conversionVersionId_fkey" FOREIGN KEY ("conversionVersionId") REFERENCES "public"."FuelUnitVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_priceVersionId_fkey" FOREIGN KEY ("priceVersionId") REFERENCES "public"."PriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderEvent" ADD CONSTRAINT "OrderEvent_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliverySheetLine" ADD CONSTRAINT "DeliverySheetLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "public"."DeliverySheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliverySheetLine" ADD CONSTRAINT "DeliverySheetLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispatch" ADD CONSTRAINT "Dispatch_deliverySheetId_fkey" FOREIGN KEY ("deliverySheetId") REFERENCES "public"."DeliverySheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Dispatch" ADD CONSTRAINT "Dispatch_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispatchLine" ADD CONSTRAINT "DispatchLine_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispatchLine" ADD CONSTRAINT "DispatchLine_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "public"."SalesOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DispatchLine" ADD CONSTRAINT "DispatchLine_sheetLineId_fkey" FOREIGN KEY ("sheetLineId") REFERENCES "public"."DeliverySheetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryConfirmation" ADD CONSTRAINT "DeliveryConfirmation_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "public"."Dispatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryConfirmation" ADD CONSTRAINT "DeliveryConfirmation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryConfirmationLine" ADD CONSTRAINT "DeliveryConfirmationLine_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "public"."DeliveryConfirmation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryConfirmationLine" ADD CONSTRAINT "DeliveryConfirmationLine_dispatchLineId_fkey" FOREIGN KEY ("dispatchLineId") REFERENCES "public"."DispatchLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBalance" ADD CONSTRAINT "StockBalance_fuelId_fkey" FOREIGN KEY ("fuelId") REFERENCES "public"."FuelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
