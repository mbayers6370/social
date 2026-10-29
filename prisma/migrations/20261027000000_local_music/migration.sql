CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "clerkId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
CREATE TABLE "ProfileSong" (
  "userId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "providerTrackId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artist" TEXT NOT NULL,
  "artworkUrl" TEXT,
  "appleUrl" TEXT NOT NULL,
  "spotifyUrl" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileSong_pkey" PRIMARY KEY ("userId", "position"),
  CONSTRAINT "ProfileSong_position_range" CHECK ("position" BETWEEN 0 AND 2),
  CONSTRAINT "ProfileSong_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfileSong_userId_providerTrackId_key" ON "ProfileSong"("userId", "providerTrackId");
