CREATE INDEX "MemberMessage_createdAt_id_idx" ON "MemberMessage" ("createdAt", "id");
ALTER TABLE "Photo" ADD COLUMN "purgeAttemptedAt" TIMESTAMP(3);
CREATE TABLE "MaintenanceJob" (
  "name" TEXT PRIMARY KEY,
  "leaseOwner" TEXT,
  "leaseUntil" TIMESTAMP(3),
  "lastStartedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFailedAt" TIMESTAMP(3),
  "failures" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "objectCursor" TEXT
);
