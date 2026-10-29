import Image from "next/image";
import type { ProfileTrack } from "./schema";

export function AppleSongBadge({ track }: { track: ProfileTrack }) {
  if (track.source !== "itunes" || !track.appleMusicUrl) return null;
  return (
    <a
      href={track.appleMusicUrl}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="margin-apple-song-badge"
      aria-label={`Get ${track.title} on the iTunes Store (opens in a new tab)`}
    >
      <Image
        src="/brands/itunes-store.svg"
        alt="Get it on iTunes"
        width={99}
        height={20}
        unoptimized
        loading="eager"
        style={{ display: "block", width: 64, height: "auto", opacity: 0.3 }}
      />
    </a>
  );
}
