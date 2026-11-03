-- A minimal application-owned display name, independent of provider identifiers.
-- Existing accounts keep a neutral name until explicitly updated.
ALTER TABLE "Account" ADD COLUMN "displayName" VARCHAR(80) NOT NULL DEFAULT 'Margin member';
ALTER TABLE "Account" ADD CONSTRAINT "Account_displayName_length" CHECK (char_length(btrim("displayName")) BETWEEN 1 AND 80);
