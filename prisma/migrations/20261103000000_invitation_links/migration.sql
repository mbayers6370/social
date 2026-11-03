CREATE TYPE "AccountRole" AS ENUM ('MEMBER', 'FOUNDER');
ALTER TABLE "Account" ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "invitationAllowanceGrantedAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD CONSTRAINT "Account_invitation_allowance_nonnegative" CHECK ("invitationsRemaining" >= 0);

CREATE TABLE "InvitationLink" (
  "id" TEXT PRIMARY KEY,
  "digest" TEXT NOT NULL UNIQUE,
  "createdBy" TEXT NOT NULL,
  "community" BOOLEAN NOT NULL DEFAULT false,
  "label" VARCHAR(80),
  "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
  "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "requestId" TEXT NOT NULL,
  CONSTRAINT "InvitationLink_capacity" CHECK ("maxRedemptions" > 0 AND "acceptedCount" >= 0 AND "acceptedCount" <= "maxRedemptions"),
  CONSTRAINT "InvitationLink_personal_capacity" CHECK ("community" OR "maxRedemptions" = 1),
  CONSTRAINT "InvitationLink_deadline" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '30 days')
);
CREATE UNIQUE INDEX "InvitationLink_createdBy_requestId_key" ON "InvitationLink" ("createdBy", "requestId");
CREATE INDEX "InvitationLink_createdBy_createdAt_idx" ON "InvitationLink" ("createdBy", "createdAt");
CREATE INDEX "InvitationLink_expiresAt_idx" ON "InvitationLink" ("expiresAt");
ALTER TABLE "Invitation" ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "clerkInvitationId" TEXT,
  ADD COLUMN "providerRevokedAt" TIMESTAMP(3),
  ADD COLUMN "deliveryAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "providerCheckedAt" TIMESTAMP(3),
  ADD COLUMN "founderSubject" TEXT,
  ADD COLUMN "linkId" TEXT REFERENCES "InvitationLink"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "Invitation_clerkInvitationId_key" ON "Invitation" ("clerkInvitationId");
CREATE INDEX "Invitation_founderSubject_idx" ON "Invitation" ("founderSubject");
CREATE INDEX "Invitation_linkId_email_idx" ON "Invitation" ("linkId", "email");
CREATE INDEX "Invitation_revokedAt_providerRevokedAt_idx" ON "Invitation" ("revokedAt", "providerRevokedAt");
-- Retire unclaimed legacy codes; completed account approvals remain intact.
UPDATE "Invitation" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "claimedBy" IS NULL;
-- One open individual invitation per normalized address across all links.
CREATE UNIQUE INDEX "Invitation_open_email_key" ON "Invitation" (lower("email"))
  WHERE "linkId" IS NOT NULL AND "claimedBy" IS NULL AND "revokedAt" IS NULL;

-- Existing issuance counts toward the lifetime allowance. This never activates accounts.
UPDATE "Account" a SET "invitationsRemaining" = GREATEST(0, 3 - (
  SELECT count(*)::integer FROM "Invitation" i WHERE i."createdBy" = a."userId"
)), "invitationAllowanceGrantedAt" = CURRENT_TIMESTAMP WHERE a."status" = 'ACTIVE';
