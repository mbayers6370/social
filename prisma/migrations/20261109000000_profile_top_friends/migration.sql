ALTER TABLE "Account" ADD COLUMN "showTopFriends" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "ProfileTopFriend" (
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "friendId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "position" INTEGER NOT NULL CHECK ("position" BETWEEN 0 AND 3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("ownerId", "friendId"),
  CONSTRAINT "ProfileTopFriend_not_self" CHECK ("ownerId" <> "friendId")
);
CREATE UNIQUE INDEX "ProfileTopFriend_ownerId_position_key" ON "ProfileTopFriend"("ownerId", "position");
CREATE INDEX "ProfileTopFriend_friendId_idx" ON "ProfileTopFriend"("friendId");
CREATE TABLE "ProfileTopFriendMutation" (
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" UUID NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("ownerId", "requestId")
);
