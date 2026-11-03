ALTER TABLE "Space" DROP CONSTRAINT "Space_event_fields";
ALTER TABLE "Space" ADD CONSTRAINT "Space_event_fields" CHECK (
  "deletedAt" IS NOT NULL OR
  ("kind" = 'EVENT' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL) OR
  ("kind" = 'PRIVATE' AND "startsAt" IS NULL AND "timeZone" IS NULL AND "location" IS NULL AND "archivedAt" IS NULL)
);
