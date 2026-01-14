-- CreateTable
CREATE TABLE "MasteryProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availablePoints" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "classProgress" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasteryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasteryProgress_userId_key" ON "MasteryProgress"("userId");

-- AddForeignKey
ALTER TABLE "MasteryProgress" ADD CONSTRAINT "MasteryProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
