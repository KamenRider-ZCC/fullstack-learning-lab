-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "aiScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpertScore" (
    "id" TEXT NOT NULL,
    "reviewItemId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpertScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpertScore_reviewItemId_idx" ON "ExpertScore"("reviewItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpertScore_reviewItemId_bidderId_expertId_key"
ON "ExpertScore"("reviewItemId", "bidderId", "expertId");

-- AddForeignKey
ALTER TABLE "ExpertScore"
ADD CONSTRAINT "ExpertScore_reviewItemId_fkey"
FOREIGN KEY ("reviewItemId") REFERENCES "ReviewItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
