ALTER TABLE "Account" ADD COLUMN "onboardedAt" TIMESTAMP(3), ADD COLUMN "ageConfirmedAt" TIMESTAMP(3);
CREATE TABLE "Invitation" (
 "id" TEXT NOT NULL,
 "digest" TEXT NOT NULL,
 "email" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "claimedBy" TEXT,
 CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invitation_digest_key" ON "Invitation"("digest");
ALTER TABLE "Account" ADD COLUMN "invitationsRemaining" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invitation" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Account" ADD CONSTRAINT "Account_invitation_budget_nonnegative" CHECK ("invitationsRemaining" >= 0);
CREATE TABLE "SafetyReport" (
 "id" TEXT NOT NULL,
 "reporterId" TEXT NOT NULL,
 "targetKind" TEXT NOT NULL CHECK ("targetKind" IN ('profile', 'post')),
 "targetId" TEXT NOT NULL,
 "targetPersonId" TEXT NOT NULL,
 "reason" TEXT NOT NULL CHECK ("reason" IN ('harassment', 'spam', 'privacy', 'harmful', 'other')),
 "details" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RECEIVED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "SafetyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SafetyReport_reporterId_createdAt_idx" ON "SafetyReport"("reporterId", "createdAt");
