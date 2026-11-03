ALTER TABLE "Space"
  ADD COLUMN "ticketmasterId" TEXT,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "sourceUrl" TEXT;

-- Existing manually created date-based Spaces were private events. Preserve
-- their content/memberships and return them to invitation-only Gatherings.
ALTER TABLE "Space" DROP CONSTRAINT "Space_event_fields";
UPDATE "Space" SET kind = 'GATHERING' WHERE kind = 'EVENT';
ALTER TABLE "Space" ADD CONSTRAINT "Space_event_fields" CHECK (
  "deletedAt" IS NOT NULL OR (
  (kind = 'PRIVATE' AND "startsAt" IS NULL AND "timeZone" IS NULL AND "location" IS NULL AND "endsAt" IS NULL AND "expiresAt" IS NULL AND "ticketmasterId" IS NULL) OR
  (kind = 'GATHERING' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL AND "expiresAt" IS NULL AND "ticketmasterId" IS NULL) OR
  (kind = 'EVENT' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL AND "ticketmasterId" IS NOT NULL AND "endsAt" > "startsAt" AND "expiresAt" = "endsAt" + INTERVAL '48 hours' AND "endsAt" IS NOT NULL AND "expiresAt" IS NOT NULL)
));
CREATE UNIQUE INDEX "Space_ticketmasterId_key" ON "Space" ("ticketmasterId");
CREATE INDEX "Space_expiresAt_idx" ON "Space" ("expiresAt");
DROP INDEX IF EXISTS "Space_manual_event_identity_key";
DROP FUNCTION IF EXISTS margin_event_text(TEXT);
