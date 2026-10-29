"use client";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getListeningLinks } from "./music-links";
import type { ProfileTrack } from "./schema";
import { TrackIdentity } from "./track-identity";
import { AppleSongBadge } from "./apple-song-badge";

const serviceMarks = {
  "Apple Music": { src: "/brands/apple-music.svg", width: 24, height: 24 },
  Spotify: { src: "/brands/spotify.svg", width: 25, height: 24 },
};

export function SongDialog({ track }: { track: ProfileTrack }) {
  const links = getListeningLinks(track);
  return (
    <Dialog>
      <div className="margin-song-card">
        <DialogTrigger asChild>
          <button
            type="button"
            className="margin-track-row margin-track-card"
            aria-label={`Open ${track.title} by ${track.artist}`}
          >
            <TrackIdentity track={track} />
            <ChevronRight
              className="margin-track-chevron"
              aria-hidden="true"
              strokeWidth={1.5}
            />
          </button>
        </DialogTrigger>
        <AppleSongBadge track={track} />
      </div>
      <DialogContent className="margin-song-dialog">
        <div className="margin-song-details">
          {track.artwork && (
            <Image
              {...track.artwork}
              alt=""
              width={112}
              height={112}
              sizes="112px"
              loading="eager"
            />
          )}
          <DialogHeader>
            <DialogTitle>{track.title}</DialogTitle>
            <DialogDescription>{track.artist}</DialogDescription>
            <AppleSongBadge track={track} />
          </DialogHeader>
        </div>
        {links.length ? (
          <div className="margin-song-services">
            {links.map((link) => (
              <a
                key={link.name}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                className="margin-song-service-link"
              >
                <Image
                  {...serviceMarks[link.name]}
                  alt=""
                  unoptimized
                  loading="eager"
                  className="margin-song-service-mark"
                />
                <span className="margin-song-service-label">
                  {link.name === "Spotify" && link.href.includes("/search/")
                    ? "Find on Spotify"
                    : `Open in ${link.name}`}
                </span>
                <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="margin-field-hint">
            Listening links aren’t available for this song yet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
