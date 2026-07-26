-- CreateEnum
CREATE TYPE "SessionCaisseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateTable
CREATE TABLE "Vendeur" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedPinAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionCaisse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "openingFloat" DECIMAL(10,2) NOT NULL,
    "closingFloat" DECIMAL(10,2),
    "variance" DECIMAL(10,2),
    "status" "SessionCaisseStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SessionCaisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointageHoraire" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOut" TIMESTAMP(3),

    CONSTRAINT "PointageHoraire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendeurId" TEXT NOT NULL,
    "sessionCaisseId" TEXT NOT NULL,
    "paymentMethod" "PosPaymentMethod" NOT NULL,
    "totalTTC" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleItem" (
    "id" TEXT NOT NULL,
    "posSaleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceTTC" DECIMAL(10,2) NOT NULL,
    "totalTTC" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendeur_tenantId_idx" ON "Vendeur"("tenantId");

-- CreateIndex
CREATE INDEX "Vendeur_tenantId_isActive_idx" ON "Vendeur"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "SessionCaisse_tenantId_idx" ON "SessionCaisse"("tenantId");

-- CreateIndex
CREATE INDEX "SessionCaisse_vendeurId_idx" ON "SessionCaisse"("vendeurId");

-- CreateIndex
CREATE INDEX "SessionCaisse_tenantId_status_idx" ON "SessionCaisse"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PointageHoraire_tenantId_idx" ON "PointageHoraire"("tenantId");

-- CreateIndex
CREATE INDEX "PointageHoraire_vendeurId_idx" ON "PointageHoraire"("vendeurId");

-- CreateIndex
CREATE INDEX "PosSale_tenantId_idx" ON "PosSale"("tenantId");

-- CreateIndex
CREATE INDEX "PosSale_sessionCaisseId_idx" ON "PosSale"("sessionCaisseId");

-- CreateIndex
CREATE INDEX "PosSale_tenantId_createdAt_idx" ON "PosSale"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PosSaleItem_posSaleId_idx" ON "PosSaleItem"("posSaleId");

-- CreateIndex
CREATE INDEX "PosSaleItem_productId_idx" ON "PosSaleItem"("productId");

-- AddForeignKey
ALTER TABLE "Vendeur" ADD CONSTRAINT "Vendeur_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionCaisse" ADD CONSTRAINT "SessionCaisse_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "Vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointageHoraire" ADD CONSTRAINT "PointageHoraire_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointageHoraire" ADD CONSTRAINT "PointageHoraire_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "Vendeur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_vendeurId_fkey" FOREIGN KEY ("vendeurId") REFERENCES "Vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSale" ADD CONSTRAINT "PosSale_sessionCaisseId_fkey" FOREIGN KEY ("sessionCaisseId") REFERENCES "SessionCaisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_posSaleId_fkey" FOREIGN KEY ("posSaleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

