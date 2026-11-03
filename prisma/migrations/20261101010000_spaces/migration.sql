-- CreateEnum
CREATE TYPE "SpaceKind" AS ENUM ('PRIVATE', 'EVENT');

-- CreateEnum
CREATE TYPE "SpaceRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SpaceRsvp" AS ENUM ('GOING', 'MAYBE', 'DECLINED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "spaceId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" "SpaceKind" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "timeZone" TEXT,
    "location" VARCHAR(300),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceMembership" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "SpaceRole" NOT NULL DEFAULT 'MEMBER',
    "includeInFeed" BOOLEAN NOT NULL DEFAULT false,
    "rsvp" "SpaceRsvp",
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMembership_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateTable
CREATE TABLE "SpaceInvitation" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "SpaceInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpacePhoto" (
    "spaceId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,

    CONSTRAINT "SpacePhoto_pkey" PRIMARY KEY ("spaceId","photoId")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpaceMembership_userId_spaceId_idx" ON "SpaceMembership"("userId", "spaceId");

-- CreateIndex
CREATE INDEX "SpaceInvitation_inviteeId_expiresAt_idx" ON "SpaceInvitation"("inviteeId", "expiresAt");

-- CreateIndex
CREATE INDEX "SpacePhoto_photoId_idx" ON "SpacePhoto"("photoId");

-- CreateIndex
CREATE INDEX "PostComment_postId_createdAt_id_idx" ON "PostComment"("postId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Post_spaceId_createdAt_id_idx" ON "Post"("spaceId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMembership" ADD CONSTRAINT "SpaceMembership_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMembership" ADD CONSTRAINT "SpaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacePhoto" ADD CONSTRAINT "SpacePhoto_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpacePhoto" ADD CONSTRAINT "SpacePhoto_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "Space" ADD CONSTRAINT "Space_name_length" CHECK (char_length(btrim("name")) BETWEEN 1 AND 100);
ALTER TABLE "Space" ADD CONSTRAINT "Space_event_fields" CHECK (
  ("kind" = 'EVENT' AND "startsAt" IS NOT NULL AND "timeZone" IS NOT NULL) OR
  ("kind" = 'PRIVATE' AND "startsAt" IS NULL AND "timeZone" IS NULL AND "location" IS NULL AND "archivedAt" IS NULL)
);
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_not_self" CHECK ("inviteeId" <> "inviterId");
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_body_length" CHECK (char_length(btrim("body")) BETWEEN 1 AND 2000);
UPDATE "Photo" SET "uploadedAt" = "createdAt" WHERE "state" = 'READY' OR "byteLength" > 1;
