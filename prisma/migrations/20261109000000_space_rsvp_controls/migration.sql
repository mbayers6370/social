-- Preserve the existing RSVP behavior for all dated Spaces.
ALTER TABLE "Space" ADD COLUMN "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true;
