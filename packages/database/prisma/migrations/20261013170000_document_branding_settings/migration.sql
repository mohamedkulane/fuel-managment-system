CREATE TABLE "DocumentBranding" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "companyName" VARCHAR(120) NOT NULL DEFAULT 'FuelDesk',
  "logoUrl" TEXT,
  "footerText" VARCHAR(500),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedById" UUID NOT NULL,
  CONSTRAINT "DocumentBranding_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DocumentBranding"
  ADD CONSTRAINT "DocumentBranding_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
