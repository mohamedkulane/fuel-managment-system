BEGIN;

INSERT INTO "TankerReceipt" ("id","receiptNo","arrivedAt","status","createdById","postedById","postedAt")
VALUES ('00000000-0000-0000-0000-000000001001','BR-SMOKE-1',CURRENT_TIMESTAMP,'POSTED','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',CURRENT_TIMESTAMP);
INSERT INTO "TankerReceiptLine" ("id","receiptId","fuelId","actualLiters") VALUES
('00000000-0000-0000-0000-000000001011','00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000000011',10000),
('00000000-0000-0000-0000-000000001012','00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000000012',15000);
INSERT INTO "InventoryMovement" ("id","fuelId","location","signedDeltaLiters","eventType","sourceType","sourceId","sourceLineId","createdById") VALUES
('00000000-0000-0000-0000-000000001021','00000000-0000-0000-0000-000000000011','WAREHOUSE',10000,'RECEIPT','TankerReceiptLine','00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001011','00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000001022','00000000-0000-0000-0000-000000000012','WAREHOUSE',15000,'RECEIPT','TankerReceiptLine','00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001012','00000000-0000-0000-0000-000000000001');
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" + 10000 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE';
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" + 15000 WHERE "fuelId" = '00000000-0000-0000-0000-000000000012' AND "location" = 'WAREHOUSE';

DO $$
BEGIN
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE') <> 10000 THEN RAISE EXCEPTION 'diesel receipt balance mismatch'; END IF;
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000012' AND "location" = 'WAREHOUSE') <> 15000 THEN RAISE EXCEPTION 'petrol receipt balance mismatch'; END IF;
END $$;

UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" - 400 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE' AND "balanceLiters" >= 400;
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" + 400 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'IN_TRANSIT';
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" - 360 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'IN_TRANSIT' AND "balanceLiters" >= 360;
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" + 40 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE';

DO $$
BEGIN
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE') <> 9640 THEN RAISE EXCEPTION 'partial delivery warehouse balance mismatch'; END IF;
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'IN_TRANSIT') <> 40 THEN RAISE EXCEPTION 'partial delivery transit balance mismatch'; END IF;
END $$;

UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" - 40 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'IN_TRANSIT' AND "balanceLiters" >= 40;
UPDATE "StockBalance" SET "balanceLiters" = "balanceLiters" + 40 WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE';
DO $$
BEGIN
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'WAREHOUSE') <> 9680 THEN RAISE EXCEPTION 'returned fuel warehouse balance mismatch'; END IF;
  IF (SELECT "balanceLiters" FROM "StockBalance" WHERE "fuelId" = '00000000-0000-0000-0000-000000000011' AND "location" = 'IN_TRANSIT') <> 0 THEN RAISE EXCEPTION 'returned fuel transit balance mismatch'; END IF;
END $$;

ROLLBACK;
