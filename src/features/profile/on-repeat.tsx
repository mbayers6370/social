"use client";
import { ChevronRight, OnRepeatAnimated } from "@/components/margin-icons";
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
  live = false,
  onSaved,
}: {
  tracks: ProfileTrack[];
  own: boolean;
  restricted?: boolean;
  live?: boolean;
  onSaved?: (tracks: ProfileTrack[]) => void;
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
            <OnRepeatAnimated size={20} className="margin-section-motif" />
          }
        >
          On Repeat
        </SectionTitle>
        {own && !restricted && (
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="margin-section-link">
                Find Music
                <ChevronRight aria-hidden="true" />
              </button>
            </DialogTrigger>
            <MusicPicker tracks={tracks} live={live} onSaved={onSaved} />
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
