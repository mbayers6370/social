"use client";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { SectionTitle } from "@/components/shared/section-motif";
import type { ProfileTrack } from "./schema";
import { SongDialog } from "./song-dialog";
import { MusicPicker } from "./music-picker";
import { ProfileSection } from "./profile-section";

export function OnRepeat({
  tracks,
  own,
  restricted = false,
}: {
  tracks: ProfileTrack[];
  own: boolean;
  restricted?: boolean;
}) {
  return (
    <ProfileSection
      className="margin-profile-music"
      aria-labelledby="on-repeat-title"
    >
      <header className="margin-section-heading">
        <SectionTitle
          id="on-repeat-title"
          motif={
            <svg
              className="margin-section-motif margin-music-equalizer"
              viewBox="0 0 20 20"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="1" y="10" width="3" height="8" rx="1.5" />
              <rect x="6" y="4" width="3" height="14" rx="1.5" />
              <rect x="11" y="7" width="3" height="11" rx="1.5" />
              <rect x="16" y="2" width="3" height="16" rx="1.5" />
            </svg>
          }
        >
          On Repeat
        </SectionTitle>
        {own && !restricted && (
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="margin-section-link">
                Find Music
                <ChevronRight aria-hidden="true" strokeWidth={1.5} />
              </button>
            </DialogTrigger>
            <MusicPicker tracks={tracks} />
          </Dialog>
        )}
      </header>
      {restricted ? (
        <p className="margin-empty-copy">Songs are shared with friends.</p>
      ) : tracks.length ? (
        <ul className="margin-on-repeat-list" aria-label="On repeat songs">
          {tracks.map((track) => (
            <li key={track.id}>
              <SongDialog track={track} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="margin-empty-copy">
          {own ? "One song you keep coming back to." : "No song here yet."}
        </p>
      )}
    </ProfileSection>
  );
}
