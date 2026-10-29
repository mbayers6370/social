import Image from "next/image";
import { Music2 } from "lucide-react";
import type { ProfileTrack } from "./schema";

export function TrackIdentity({ track }: { track: ProfileTrack }) {
  return (
    <>
      {track.artwork ? (
        <Image
          {...track.artwork}
          alt=""
          width={80}
          height={80}
          sizes="80px"
          loading="eager"
        />
      ) : (
        <span className="margin-track-artwork-placeholder" aria-hidden="true">
          <Music2 strokeWidth={1.5} />
        </span>
      )}
      <span className="margin-track-identity">
        <strong>{track.title}</strong>
        <span>{track.artist}</span>
      </span>
    </>
  );
}
