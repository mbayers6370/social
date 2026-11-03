ALTER TABLE "Account"
  ADD COLUMN "portraitPhotoId" TEXT,
  ADD COLUMN "usernameChangedAt" TIMESTAMP(3),
  ADD COLUMN "galleryVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "readingSize" VARCHAR(16) NOT NULL DEFAULT 'standard',
  ADD COLUMN "motion" VARCHAR(16) NOT NULL DEFAULT 'system',
  ADD COLUMN "notifyComments" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyLikes" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyFriends" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "Account_portraitPhotoId_fkey" FOREIGN KEY ("portraitPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Account_readingSize_check" CHECK ("readingSize" IN ('standard','larger','extra-large')),
  ADD CONSTRAINT "Account_motion_check" CHECK ("motion" IN ('system','reduced')),
  ADD CONSTRAINT "Account_galleryVersion_check" CHECK ("galleryVersion" >= 0);

ALTER TABLE "GalleryEntry" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
WITH ordered AS (
  SELECT g."photoId", row_number() OVER (PARTITION BY g."ownerId" ORDER BY p."createdAt" DESC, g."photoId" DESC) - 1 AS rank
  FROM "GalleryEntry" g JOIN "Photo" p ON p.id = g."photoId"
) UPDATE "GalleryEntry" g SET "position" = ordered.rank FROM ordered WHERE g."photoId" = ordered."photoId";
ALTER TABLE "GalleryEntry" ADD CONSTRAINT "GalleryEntry_position_check" CHECK ("position" >= 0);
CREATE INDEX "GalleryEntry_ownerId_position_idx" ON "GalleryEntry"("ownerId", "position");

CREATE TABLE "MemberMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" VARCHAR(80) NOT NULL,
  "body" VARCHAR(2000) NOT NULL CHECK (length(btrim("body")) > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "hiddenBySender" BOOLEAN NOT NULL DEFAULT false,
  "hiddenByRecipient" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "MemberMessage_senderId_requestId_key" ON "MemberMessage"("senderId", "requestId");
CREATE INDEX "MemberMessage_senderId_recipientId_createdAt_id_idx" ON "MemberMessage"("senderId", "recipientId", "createdAt", "id");
CREATE INDEX "MemberMessage_recipientId_readAt_createdAt_idx" ON "MemberMessage"("recipientId", "readAt", "createdAt");

CREATE TABLE "MemberNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" VARCHAR(24) NOT NULL CHECK ("kind" IN ('friend_request','friend_accepted','comment','reply','like','message')),
  "postId" TEXT REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "dedupeKey" VARCHAR(200) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "MemberNotification_dedupeKey_key" ON "MemberNotification"("dedupeKey");
CREATE INDEX "MemberNotification_recipientId_createdAt_id_idx" ON "MemberNotification"("recipientId", "createdAt", "id");

CREATE TABLE "PostLike" (
  "postId" TEXT NOT NULL REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("postId", "userId")
);
