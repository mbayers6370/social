-- Authentication remains in Clerk; these are canonical Margin profile/eligibility fields.
ALTER TABLE "Account" ADD COLUMN "username" VARCHAR(24),
  ADD COLUMN "bio" VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");
ALTER TABLE "Account" ADD CONSTRAINT "Account_username_format" CHECK (
  "username" IS NULL OR ("username" = lower("username") AND "username" ~ '^[a-z][a-z0-9_]{2,23}$')
);
