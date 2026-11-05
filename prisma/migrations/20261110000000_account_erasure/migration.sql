CREATE TABLE "AccountErasure" (
  "userId" TEXT NOT NULL,
  "clerkId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerDeletedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AccountErasure_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX "AccountErasure_clerkId_key" ON "AccountErasure"("clerkId");
CREATE INDEX "AccountErasure_completedAt_nextAttemptAt_idx" ON "AccountErasure"("completedAt", "nextAttemptAt");
CREATE INDEX "Invitation_createdBy_claimedBy_providerRevokedAt_idx" ON "Invitation"("createdBy", "claimedBy", "providerRevokedAt");
CREATE INDEX "Invitation_claimedBy_idx" ON "Invitation"("claimedBy");
CREATE INDEX "SafetyReport_targetPersonId_idx" ON "SafetyReport"("targetPersonId");
CREATE INDEX "OperatorAction_targetId_idx" ON "OperatorAction"("targetId");
CREATE INDEX "Space_creatorId_idx" ON "Space"("creatorId");
CREATE INDEX "PostComment_authorId_idx" ON "PostComment"("authorId");
