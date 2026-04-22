-- Deduplicate existing rows before adding unique constraint
DELETE FROM "AssetAllocation"
WHERE "id" NOT IN (
  SELECT MAX("id")
  FROM "AssetAllocation"
  GROUP BY "accountId", "assetId"
);

-- Ensure one allocation row per account + asset
CREATE UNIQUE INDEX "AssetAllocation_accountId_assetId_key" ON "AssetAllocation"("accountId", "assetId");
