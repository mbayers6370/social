import { z } from "zod";

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash
      ? url
      : null;
  } catch {
    return null;
  }
}
export const appleSongUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    const url = safeUrl(value);
    return (
      !!url &&
      ["music.apple.com", "itunes.apple.com"].includes(url.hostname) &&
      /^\/[a-z]{2}\/(album|song)\/[^/]+\/\d+$/.test(url.pathname) &&
      [...url.searchParams.keys()].every((key) => ["i", "uo"].includes(key)) &&
      (!url.pathname.includes("/album/") ||
        /^\d+$/.test(url.searchParams.get("i") ?? "")) &&
      (!url.searchParams.has("uo") || url.searchParams.get("uo") === "4")
    );
  });
export const spotifySongUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    const url = safeUrl(value);
    return (
      !!url &&
      url.hostname === "open.spotify.com" &&
      !url.search &&
      (/^\/track\/[A-Za-z0-9]{22}$/.test(url.pathname) ||
        /^\/search\/[^/]{1,1600}$/.test(url.pathname))
    );
  });
export function isAppleArtwork(value: string) {
  const url = safeUrl(value);
  return (
    !!url &&
    /^is[1-5]-ssl\.mzstatic\.com$/.test(url.hostname) &&
    url.pathname.startsWith("/image/thumb/") &&
    /\.(jpg|jpeg|png|webp)$/i.test(url.pathname) &&
    !url.search
  );
}
const artwork = z.strictObject({
  src: z
    .string()
    .max(2048)
    .refine(
      (value) =>
        /^\/_next\/static\/media\/[a-zA-Z0-9_.-]+\.(jpg|jpeg|png|webp)$/i.test(
          value,
        ) || isAppleArtwork(value),
    ),
  width: z.number().int().positive().max(10000),
  height: z.number().int().positive().max(10000),
});
export const profileTrackSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  artwork: artwork.optional(),
  appleMusicUrl: appleSongUrlSchema.optional(),
  spotifyUrl: spotifySongUrlSchema.optional(),
  source: z.literal("itunes").optional(),
});
export type ProfileTrack = z.infer<typeof profileTrackSchema>;
export const musicSelectionSchema = z
  .array(profileTrackSchema)
  .max(1)
  .refine(
    (tracks) => new Set(tracks.map((track) => track.id)).size === tracks.length,
  );
export const musicSearchSchema = z
  .string()
  .trim()
  .min(2, "Enter at least two characters.")
  .max(80)
  .regex(/^[^\u0000-\u001f\u007f]+$/);
export const musicChangeSchema = z.strictObject({
  action: z.enum(["add", "remove"]),
  trackId: z.string().regex(/^itunes-\d{1,16}$/),
});
