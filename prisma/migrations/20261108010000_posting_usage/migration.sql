ALTER TABLE "Account" ADD COLUMN "postingTimeZone" VARCHAR(100) NOT NULL DEFAULT 'America/Los_Angeles';
ALTER TABLE "Account" ADD COLUMN "postingUsageCarryFrom" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "postingUsageCarryUntil" TIMESTAMP(3);
CREATE TABLE "PostingUsage" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "hasLink" BOOLEAN NOT NULL,
    "timeZone" VARCHAR(100) NOT NULL,
    CONSTRAINT "PostingUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PostingUsage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostingUsage_postId_key" ON "PostingUsage"("postId");
CREATE INDEX "PostingUsage_ownerId_createdAt_idx" ON "PostingUsage"("ownerId", "createdAt");
CREATE INDEX "PostingUsage_createdAt_id_idx" ON "PostingUsage"("createdAt", "id");
-- Preserve all recoverable publication usage. Already hard-deleted historical posts cannot be reconstructed.
INSERT INTO "PostingUsage" ("id", "postId", "ownerId", "createdAt", "hasLink", "timeZone")
SELECT 'legacy-' || "id", "id", "ownerId", "createdAt", "hasLink", 'America/Los_Angeles'
FROM "Post" WHERE "spaceId" IS NULL;
