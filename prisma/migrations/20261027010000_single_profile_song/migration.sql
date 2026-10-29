-- Preserve the most recently selected song when reducing the local selection to one.
WITH ranked AS (
  SELECT "userId", "position",
    ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "updatedAt" DESC, "position" ASC) AS rank
  FROM "ProfileSong"
)
DELETE FROM "ProfileSong" AS song USING ranked
WHERE song."userId" = ranked."userId" AND song."position" = ranked."position" AND ranked.rank > 1;

UPDATE "ProfileSong" SET "position" = 0 WHERE "position" <> 0;
ALTER TABLE "ProfileSong" DROP CONSTRAINT "ProfileSong_position_range";
ALTER TABLE "ProfileSong" ADD CONSTRAINT "ProfileSong_position_range" CHECK ("position" = 0);
