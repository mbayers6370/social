-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "PhotoState" AS ENUM ('PENDING', 'READY', 'DELETE_PENDING', 'PURGED');

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Account_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "lowId" TEXT NOT NULL,
    "highId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("lowId","highId")
);

-- CreateTable
CREATE TABLE "Block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hasLink" BOOLEAN NOT NULL,
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "state" "PhotoState" NOT NULL DEFAULT 'PENDING',
    "dayKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteLength" INTEGER NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostPhoto" (
    "postId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "PostPhoto_pkey" PRIMARY KEY ("postId","photoId")
);

-- CreateTable
CREATE TABLE "GalleryEntry" (
    "photoId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "GalleryEntry_pkey" PRIMARY KEY ("photoId")
);

-- CreateIndex
CREATE INDEX "Friendship_highId_status_idx" ON "Friendship"("highId", "status");

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "Block"("blockedId");

-- CreateIndex
CREATE INDEX "Post_ownerId_dayKey_idx" ON "Post"("ownerId", "dayKey");

-- CreateIndex
CREATE INDEX "Post_expiresAt_idx" ON "Post"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Post_id_ownerId_key" ON "Post"("id", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_objectKey_key" ON "Photo"("objectKey");

-- CreateIndex
CREATE INDEX "Photo_ownerId_dayKey_state_idx" ON "Photo"("ownerId", "dayKey", "state");

-- CreateIndex
CREATE INDEX "Photo_state_uploadExpiresAt_idx" ON "Photo"("state", "uploadExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_id_ownerId_key" ON "Photo"("id", "ownerId");

-- CreateIndex
CREATE INDEX "PostPhoto_photoId_idx" ON "PostPhoto"("photoId");

-- CreateIndex
CREATE INDEX "GalleryEntry_ownerId_idx" ON "GalleryEntry"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryEntry_photoId_ownerId_key" ON "GalleryEntry"("photoId", "ownerId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_lowId_fkey" FOREIGN KEY ("lowId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_highId_fkey" FOREIGN KEY ("highId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPhoto" ADD CONSTRAINT "PostPhoto_postId_ownerId_fkey" FOREIGN KEY ("postId", "ownerId") REFERENCES "Post"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPhoto" ADD CONSTRAINT "PostPhoto_photoId_ownerId_fkey" FOREIGN KEY ("photoId", "ownerId") REFERENCES "Photo"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryEntry" ADD CONSTRAINT "GalleryEntry_photoId_ownerId_fkey" FOREIGN KEY ("photoId", "ownerId") REFERENCES "Photo"("id", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryEntry" ADD CONSTRAINT "GalleryEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cross-row quotas are serialized by the DAL; intrinsic invariants live here.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_pair_check" CHECK ("lowId" < "highId" AND "requesterId" IN ("lowId", "highId"));
ALTER TABLE "Block" ADD CONSTRAINT "Block_not_self" CHECK ("blockerId" <> "blockedId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_body_length" CHECK (char_length(body) <= 2000);
ALTER TABLE "Post" ADD CONSTRAINT "Post_expiry" CHECK ("expiresAt" > "createdAt");
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_bounds" CHECK (width BETWEEN 1 AND 10000 AND height BETWEEN 1 AND 10000 AND width::bigint * height <= 40000000 AND "byteLength" BETWEEN 1 AND 8388608 AND char_length(description) <= 500);
