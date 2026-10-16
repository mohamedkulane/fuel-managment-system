-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedById" UUID;

-- AlterTable
ALTER TABLE "public"."SalesOrder" ADD COLUMN     "amendedAt" TIMESTAMP(3),
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" UUID;

-- AlterTable
ALTER TABLE "public"."SalesOrderLine" ADD COLUMN     "amendedUnits" DECIMAL(18,3) NOT NULL DEFAULT 0,
ADD COLUMN     "amendmentApprovedAt" TIMESTAMP(3),
ADD COLUMN     "amendmentApprovedById" UUID,
ADD COLUMN     "amendmentReason" TEXT,
ADD COLUMN     "cancelledUnits" DECIMAL(18,3) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."UserPermission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "permission" TEXT NOT NULL,
    "grantedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "public"."UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "public"."UserPermission"("userId", "permission");

-- CreateIndex
CREATE INDEX "Customer_status_archivedAt_idx" ON "public"."Customer"("status", "archivedAt");

-- AddForeignKey
ALTER TABLE "public"."Customer" ADD CONSTRAINT "Customer_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_amendmentApprovedById_fkey" FOREIGN KEY ("amendmentApprovedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPermission" ADD CONSTRAINT "UserPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
