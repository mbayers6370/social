import { appleSongUrlSchema, spotifySongUrlSchema } from "./music-schema";
import type { ProfileTrack } from "./schema";

// Only direct HTTPS song pages: no embeds, arbitrary hosts, redirects or scripts.

export function getITunesPurchaseUrl(track: ProfileTrack) {
  if (track.source !== "itunes") return null;
  const result = appleSongUrlSchema.safeParse(track.appleMusicUrl);
  if (!result.success) return null;
  const url = new URL(result.data);
  url.searchParams.set("app", "itunes");
  return url.href;
}

export function getListeningLinks(track: ProfileTrack) {
  // Apple-supplied artwork promotes its iTunes purchase link, not other services.
  if (track.source === "itunes") return [];
  return [
    {
      name: "Apple Music" as const,
      url: appleSongUrlSchema.safeParse(track.appleMusicUrl),
    },
    {
      name: "Spotify" as const,
      url: spotifySongUrlSchema.safeParse(track.spotifyUrl),
    },
  ].flatMap(({ name, url }) => (url.success ? [{ name, href: url.data }] : []));
}
