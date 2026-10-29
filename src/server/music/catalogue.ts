import "server-only";
import { z } from "zod";
import {
  isAppleArtwork,
  musicSearchSchema,
  profileTrackSchema,
  type ProfileTrack,
} from "@/features/profile/music-schema";

export class MusicError extends Error {
  constructor(
    message: string,
    public readonly status = 503,
  ) {
    super(message);
  }
}
const itemSchema = z.object({
  wrapperType: z.literal("track"),
  kind: z.literal("song"),
  trackId: z.number().int().positive().safe(),
  trackName: z.string().min(1).max(200),
  artistName: z.string().min(1).max(200),
  trackViewUrl: z.string(),
  artworkUrl100: z.string().optional(),
});
export function parseCatalogue(payload: unknown): ProfileTrack[] {
  const result = z
    .object({ results: z.array(z.unknown()).max(200) })
    .safeParse(payload);
  if (!result.success)
    throw new MusicError("Music search is temporarily unavailable.");
  const tracks = new Map<string, ProfileTrack>();
  for (const raw of result.data.results) {
    const item = itemSchema.safeParse(raw);
    if (!item.success) continue;
    const song = item.data;
    const track = profileTrackSchema.safeParse({
      id: `itunes-${song.trackId}`,
      title: song.trackName,
      artist: song.artistName,
      source: "itunes",
      appleMusicUrl: song.trackViewUrl,
      spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(`${song.trackName} ${song.artistName}`)}`,
      ...(song.artworkUrl100 && isAppleArtwork(song.artworkUrl100)
        ? { artwork: { src: song.artworkUrl100, width: 100, height: 100 } }
        : {}),
    });
    if (
      track.success &&
      new URL(track.data.appleMusicUrl!).searchParams.get("i") ===
        String(song.trackId)
    )
      tracks.set(track.data.id, track.data);
  }
  return [...tracks.values()];
}

/** Small bounded cache/budget for one local dev process. Production uses shared limits. */
export function createCatalogue(
  fetcher: typeof fetch = fetch,
  clock = Date.now,
) {
  const cache = new Map<string, { expires: number; tracks: ProfileTrack[] }>();
  const inFlight = new Map<string, Promise<ProfileTrack[]>>();
  let calls: number[] = [];
  async function load(key: string, url: URL): Promise<ProfileTrack[]> {
    const now = clock();
    const hit = cache.get(key);
    if (hit && hit.expires > now) return hit.tracks;
    const pending = inFlight.get(key);
    if (pending) return pending;
    calls = calls.filter((time) => time > now - 60_000);
    if (calls.length >= 15)
      throw new MusicError(
        "Music search is busy. Please try again shortly.",
        429,
      );
    calls.push(now);
    const work = (async () => {
      try {
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(6000),
          redirect: "error",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (
          !response.ok ||
          Number(response.headers.get("content-length") ?? 0) > 512_000
        )
          throw new MusicError("Music search is temporarily unavailable.");
        // Bound the actual stream as well as the optional Content-Length header.
        const reader = response.body?.getReader();
        if (!reader)
          throw new MusicError("Music search is temporarily unavailable.");
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > 512_000) {
              await reader.cancel();
              throw new MusicError("Music search is temporarily unavailable.");
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const tracks = parseCatalogue(
          JSON.parse(new TextDecoder().decode(bytes)),
        );
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: clock() + 600_000, tracks });
        return tracks;
      } catch (error) {
        if (error instanceof MusicError) throw error;
        throw new MusicError("Music search is temporarily unavailable.");
      }
    })();
    inFlight.set(key, work);
    try {
      return await work;
    } finally {
      inFlight.delete(key);
    }
  }
  return {
    search(query: string) {
      const term = musicSearchSchema.parse(query.normalize("NFKC"));
      const url = new URL("https://itunes.apple.com/search");
      url.search = new URLSearchParams({
        term,
        country: "US",
        media: "music",
        entity: "song",
        limit: "20",
      }).toString();
      return load(`search:${term.toLocaleLowerCase("en")}`, url);
    },
    async lookup(trackId: string) {
      if (!/^itunes-\d{1,16}$/.test(trackId))
        throw new MusicError("Choose a song from the results.", 400);
      for (const cached of cache.values()) {
        if (cached.expires > clock()) {
          const track = cached.tracks.find((item) => item.id === trackId);
          if (track) return track;
        }
      }
      const url = new URL("https://itunes.apple.com/lookup");
      url.search = new URLSearchParams({
        id: trackId.slice(7),
        country: "US",
        entity: "song",
      }).toString();
      const tracks = await load(`lookup:${trackId}`, url);
      const track = tracks.find((item) => item.id === trackId);
      if (!track)
        throw new MusicError("That song is no longer available.", 404);
      return track;
    },
  };
}
const globalMusic = globalThis as unknown as {
  localMusicCatalogue?: ReturnType<typeof createCatalogue>;
};
export const catalogue = globalMusic.localMusicCatalogue ?? createCatalogue();
if (process.env.NODE_ENV === "development")
  globalMusic.localMusicCatalogue = catalogue;
