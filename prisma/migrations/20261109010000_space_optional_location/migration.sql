-- A private Space may have a location without having scheduled plans.
-- Public provider Events retain their existing schedule/expiry invariants.
ALTER TABLE "Space" DROP CONSTRAINT "Space_event_fields";
ALTER TABLE "Space" ADD CONSTRAINT "Space_event_fields" CHECK (
  "deletedAt" IS NOT NULL OR (
    (kind = 'PRIVATE' AND "startsAt" IS NULL AND "timeZone" IS NULL AND "endsAt" IS NULL AND "expiresAt" IS NULL AND "ticketmasterId" IS NULL) OR
    (kind = 'GATHERING' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL AND ("endsAt" IS NULL OR "endsAt" > "startsAt") AND "expiresAt" IS NULL AND "ticketmasterId" IS NULL) OR
    (kind = 'EVENT' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL AND "ticketmasterId" IS NOT NULL AND "endsAt" > "startsAt" AND "expiresAt" = "endsAt" + INTERVAL '48 hours' AND "endsAt" IS NOT NULL AND "expiresAt" IS NOT NULL)
  )
);
