-- Rattrapage complet du schéma prod (Supabase) — jamais poussé depuis les modules
-- Boutique/Produits, POS (vente à la demande) et Vue Stock Global (BomStock.stockId).
-- Cause racine : git push ne déploie que le code (Vercel), jamais le schéma Prisma —
-- ce sandbox ne peut pas non plus lancer `prisma db push` (DATABASE_URL scrubée), donc
-- chaque évolution de schema.prisma doit être traduite en SQL brut et appliquée via
-- `supabase db query --linked` (API Management, contourne le scrub).
--
-- Vérifié avant exécution (2026-07-27) : Product/OrderItem/PosSaleItem/Recipe/BomStock
-- ont 0 ligne dépendante en prod sur les 3 tenants existants — DROP/ADD sans perte de
-- données réelles. Chaque étape est idempotente (IF NOT EXISTS / vérifications) sauf le
-- DROP TABLE "Product" (volontaire, table vide, ancien schéma pré-BOM incompatible).

BEGIN;

-- ── Enums manquants (module Boutique/Produits — TVA, allocation canal, clôtures) ──
DO $$ BEGIN
  CREATE TYPE "StockChannel" AS ENUM ('VITRINE', 'DIRECT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClosureReason" AS ENUM ('WASTE', 'STAFF', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Product : ancien schéma pré-BOM (recipeId/vatRate enum/stockType/stockQuantity),
-- 0 ligne en prod sur les 3 tenants → drop + recreate propre plutôt qu'ALTER partiel.
DROP TABLE IF EXISTS "Product" CASCADE;

CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bomSheetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "descriptionLong" TEXT,
    "category" TEXT,
    "images" JSONB NOT NULL DEFAULT '[]',
    "priceHT" DECIMAL(10,2) NOT NULL,
    "priceTTC" DECIMAL(10,2) NOT NULL,
    "vatRateId" TEXT NOT NULL,
    "marginTargetFactor" DECIMAL(5,2),
    "isPerishable" BOOLEAN NOT NULL DEFAULT false,
    "allergens" JSONB NOT NULL DEFAULT '[]',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isClickCollect" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantVatRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantVatRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductChannelStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomStockId" TEXT NOT NULL,
    "channel" "StockChannel" NOT NULL,
    "qtyAllocated" DECIMAL(12,4) NOT NULL,
    "qtyRemaining" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductChannelStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockClosure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productChannelStockId" TEXT NOT NULL,
    "qty" DECIMAL(12,4) NOT NULL,
    "reason" "ClosureReason" NOT NULL,
    "note" TEXT,
    "closedByUserId" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockClosure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product"("tenantId");
CREATE INDEX IF NOT EXISTS "Product_tenantId_category_idx" ON "Product"("tenantId", "category");
CREATE INDEX IF NOT EXISTS "Product_tenantId_isVisible_isActive_idx" ON "Product"("tenantId", "isVisible", "isActive");
CREATE INDEX IF NOT EXISTS "Product_bomSheetId_idx" ON "Product"("bomSheetId");
CREATE INDEX IF NOT EXISTS "Product_vatRateId_idx" ON "Product"("vatRateId");
CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenantId_slug_key" ON "Product"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "TenantVatRate_tenantId_idx" ON "TenantVatRate"("tenantId");
CREATE INDEX IF NOT EXISTS "TenantVatRate_tenantId_isActive_idx" ON "TenantVatRate"("tenantId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "TenantVatRate_tenantId_label_key" ON "TenantVatRate"("tenantId", "label");
CREATE INDEX IF NOT EXISTS "ProductChannelStock_tenantId_idx" ON "ProductChannelStock"("tenantId");
CREATE INDEX IF NOT EXISTS "ProductChannelStock_productId_channel_idx" ON "ProductChannelStock"("productId", "channel");
CREATE INDEX IF NOT EXISTS "ProductChannelStock_bomStockId_idx" ON "ProductChannelStock"("bomStockId");
CREATE INDEX IF NOT EXISTS "StockClosure_tenantId_idx" ON "StockClosure"("tenantId");
CREATE INDEX IF NOT EXISTS "StockClosure_productChannelStockId_idx" ON "StockClosure"("productChannelStockId");

ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_bomSheetId_fkey" FOREIGN KEY ("bomSheetId") REFERENCES "BomSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_vatRateId_fkey" FOREIGN KEY ("vatRateId") REFERENCES "TenantVatRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantVatRate" ADD CONSTRAINT "TenantVatRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelStock" ADD CONSTRAINT "ProductChannelStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelStock" ADD CONSTRAINT "ProductChannelStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductChannelStock" ADD CONSTRAINT "ProductChannelStock_bomStockId_fkey" FOREIGN KEY ("bomStockId") REFERENCES "BomStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockClosure" ADD CONSTRAINT "StockClosure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockClosure" ADD CONSTRAINT "StockClosure_productChannelStockId_fkey" FOREIGN KEY ("productChannelStockId") REFERENCES "ProductChannelStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockClosure" ADD CONSTRAINT "StockClosure_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── OrderItem/PosSaleItem : FKs vers Product cassées par le DROP CASCADE ci-dessus,
-- à recréer explicitement (0 ligne existante sur les 3 tenants, vérifié).
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── OrderItem.vatRate (ancien enum VatRate) → vatRatePercent (Decimal 5,2) — 0 ligne.
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "vatRate";
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "vatRatePercent" DECIMAL(5,2) NOT NULL;

-- ── PosSaleItem : productionId + unitCost jamais poussés (rework vente à la demande).
ALTER TABLE "PosSaleItem" ADD COLUMN IF NOT EXISTS "productionId" TEXT;
ALTER TABLE "PosSaleItem" ADD COLUMN IF NOT EXISTS "unitCost" DECIMAL(10,4) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "PosSaleItem_productionId_idx" ON "PosSaleItem"("productionId");
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "BomProduction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Recipe.productId jamais poussé (lien Recipe → Product post-migration BOM).
ALTER TABLE "Recipe" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── BomStock.stockId jamais poussé (traçabilité Stock des produits, règle #40 JOURNAL).
ALTER TABLE "BomStock" ADD COLUMN IF NOT EXISTS "stockId" TEXT;
CREATE INDEX IF NOT EXISTS "BomStock_stockId_idx" ON "BomStock"("stockId");
ALTER TABLE "BomStock" ADD CONSTRAINT "BomStock_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
