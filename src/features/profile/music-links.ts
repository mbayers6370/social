import { appleSongUrlSchema, spotifySongUrlSchema } from "./music-schema";
import type { ProfileTrack } from "./schema";

// Only direct HTTPS song pages: no embeds, arbitrary hosts, redirects or scripts.

export function getListeningLinks(track: ProfileTrack) {
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
