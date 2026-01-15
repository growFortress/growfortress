-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('DUST', 'STARTER_PACK', 'HERO', 'COSMETIC', 'BATTLE_PASS', 'BOOSTER', 'CONVENIENCE', 'GACHA');

-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "productName" TEXT NOT NULL,
    "pricePLN" INTEGER NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "stripeSessionId" TEXT,
    "stripePaymentId" TEXT,
    "dustGranted" INTEGER,
    "goldGranted" INTEGER,
    "heroGranted" TEXT,
    "cosmeticGranted" TEXT,
    "materialsGranted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPurchaseLimit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "purchaseCount" INTEGER NOT NULL DEFAULT 0,
    "lastPurchase" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPurchaseLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveBooster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveBooster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "equippedOn" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_stripeSessionId_key" ON "ShopPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ShopPurchase_userId_idx" ON "ShopPurchase"("userId");

-- CreateIndex
CREATE INDEX "ShopPurchase_status_idx" ON "ShopPurchase"("status");

-- CreateIndex
CREATE INDEX "ShopPurchase_stripeSessionId_idx" ON "ShopPurchase"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ShopPurchase_createdAt_idx" ON "ShopPurchase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPurchaseLimit_userId_productId_key" ON "UserPurchaseLimit"("userId", "productId");

-- CreateIndex
CREATE INDEX "UserPurchaseLimit_userId_idx" ON "UserPurchaseLimit"("userId");

-- CreateIndex
CREATE INDEX "ActiveBooster_userId_idx" ON "ActiveBooster"("userId");

-- CreateIndex
CREATE INDEX "ActiveBooster_expiresAt_idx" ON "ActiveBooster"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticId_key" ON "UserCosmetic"("userId", "cosmeticId");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPurchaseLimit" ADD CONSTRAINT "UserPurchaseLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveBooster" ADD CONSTRAINT "ActiveBooster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
