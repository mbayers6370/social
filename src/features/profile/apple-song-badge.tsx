import Image from "next/image";
import { getITunesPurchaseUrl } from "./music-links";
import type { ProfileTrack } from "./schema";

export function AppleSongBadge({ track }: { track: ProfileTrack }) {
  const purchaseUrl = getITunesPurchaseUrl(track);
  if (!purchaseUrl) return null;
  return (
    <a
      href={purchaseUrl}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="margin-apple-song-badge"
      aria-label={`Get ${track.title} on the iTunes Store (opens in a new tab)`}
    >
      <Image
        src="/brands/itunes-store.svg"
        alt="Get it on iTunes"
        width={317}
        height={64}
        unoptimized
        loading="eager"
      />
    </a>
  );
}
