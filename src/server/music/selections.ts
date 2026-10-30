import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { catalogue, MusicError } from "./catalogue";
import {
  musicChangeSchema,
  profileTrackSchema,
  type ProfileTrack,
} from "@/features/profile/music-schema";

export const LOCAL_MUSIC_VIEWER = "local-preview:ines";
export function localMusicDb() {
  let url: URL;
  try {
    url = new URL(process.env.DATABASE_URL ?? "");
  } catch {
    throw new MusicError("Saved music is temporarily unavailable.");
  }
  if (
    process.env.NODE_ENV !== "development" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "55432" ||
    url.pathname !== "/margin_local" ||
    url.username !== "margin_runtime" ||
    !["postgresql:", "postgres:"].includes(url.protocol)
  )
    throw new MusicError("Saved music is temporarily unavailable.");
  return getDb();
}
function fromRow(row: {
  providerTrackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  appleUrl: string;
  spotifyUrl: string;
}): ProfileTrack {
  return profileTrackSchema.parse({
    id: row.providerTrackId,
    title: row.title,
    artist: row.artist,
    source: "itunes",
    appleMusicUrl: row.appleUrl,
    spotifyUrl: row.spotifyUrl,
    ...(row.artworkUrl
      ? { artwork: { src: row.artworkUrl, width: 100, height: 100 } }
      : {}),
  });
}
export async function readMusic(subject = LOCAL_MUSIC_VIEWER) {
  if (!subject.startsWith("local-preview:"))
    throw new MusicError("Request not allowed.", 403);
  const user = await localMusicDb().user.findUnique({
    where: { clerkId: subject },
    select: { songs: { orderBy: { position: "asc" } } },
  });
  return user?.songs.map(fromRow) ?? [];
}
export async function changeMusic(
  input: unknown,
  subject = LOCAL_MUSIC_VIEWER,
) {
  if (!subject.startsWith("local-preview:"))
    throw new MusicError("Request not allowed.", 403);
  const parsed = musicChangeSchema.safeParse(input);
  if (!parsed.success)
    throw new MusicError("Choose a song from the search results.", 400);
  const db = localMusicDb();
  const { action, trackId } = parsed.data;
  const track = action === "add" ? await catalogue.lookup(trackId) : null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const user = await tx.user.upsert({
            where: { clerkId: subject },
            create: { clerkId: subject },
            update: {},
            // Keep the preview adapter compatible before the additive social migration.
            select: { id: true },
          });
          const rows = await tx.profileSong.findMany({
            where: { userId: user.id },
            orderBy: { position: "asc" },
          });
          if (action === "remove")
            await tx.profileSong.deleteMany({
              where: { userId: user.id, providerTrackId: trackId },
            });
          else if (
            track &&
            !rows.some((row) => row.providerTrackId === trackId)
          ) {
            await tx.profileSong.deleteMany({ where: { userId: user.id } });
            await tx.profileSong.create({
              data: {
                userId: user.id,
                position: 0,
                providerTrackId: track.id,
                title: track.title,
                artist: track.artist,
                artworkUrl: track.artwork?.src,
                appleUrl: track.appleMusicUrl!,
                spotifyUrl: track.spotifyUrl!,
              },
            });
          }
          return (
            await tx.profileSong.findMany({
              where: { userId: user.id },
              orderBy: { position: "asc" },
            })
          ).map(fromRow);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code) &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new MusicError("Saved music is temporarily unavailable.");
}
