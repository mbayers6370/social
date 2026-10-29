"use client";
import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { z } from "zod";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field";
import { usePreview } from "@/features/local-preview/provider";
import {
  musicSelectionSchema,
  profileTrackSchema,
  type ProfileTrack,
} from "./music-schema";
import { TrackIdentity } from "./track-identity";
import { AppleSongBadge } from "./apple-song-badge";

const searchResponse = z.strictObject({
  tracks: z.array(profileTrackSchema).max(20),
});
export function MusicPicker({ tracks }: { tracks: ProfileTrack[] }) {
  const preview = usePreview();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const selected = new Set(tracks.map((track) => track.id));
  const term = query.trim();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResults([]);
      setSearched(false);
      setError("");
      if (term.length < 2) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch(
          `/api/development/music?q=${encodeURIComponent(term)}`,
          {
            headers: { "X-Margin-Preview": "1" },
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error();
        const data = searchResponse.parse(await response.json());
        if (!controller.signal.aborted) {
          setResults(data.tracks);
          setSearched(true);
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Music search is temporarily unavailable. Please try again shortly.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);
  async function change(track: ProfileTrack, remove: boolean) {
    setPending(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/development/music/selections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Margin-Preview": "1",
        },
        body: JSON.stringify({
          action: remove ? "remove" : "add",
          trackId: track.id,
        }),
      });
      if (!response.ok) {
        setError("Your music couldn’t be saved. Please try again.");
        return;
      }
      const data: unknown = await response.json();
      const saved = z
        .strictObject({ tracks: musicSelectionSchema })
        .parse(data);
      preview.setMusic(saved.tracks);
      setStatus(
        `${track.title} ${remove ? "removed from" : "added to"} On Repeat.`,
      );
    } catch {
      setError("Your music couldn’t be saved. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <DialogContent className="margin-music-picker">
      <DialogHeader>
        <DialogTitle>Find Music</DialogTitle>
        <DialogDescription>
          Search for a song or artist. Choose one song for your profile.
        </DialogDescription>
      </DialogHeader>
      {tracks.length > 0 && (
        <ul className="margin-music-selection" aria-label="Your selection">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${track.title} from On Repeat`}
                onClick={() => change(track, true)}
              >
                {track.title}
                <X aria-hidden="true" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Label htmlFor="music-query">Song or artist</Label>
        <Input
          id="music-query"
          type="search"
          value={query}
          maxLength={80}
          onChange={(event) => {
            setQuery(event.target.value);
            setResults([]);
            setSearched(false);
            setError("");
            setLoading(event.target.value.trim().length >= 2);
          }}
          autoComplete="off"
        />
      </div>
      <div aria-busy={loading || pending}>
        {term.length < 2 && (
          <p className="margin-field-hint">
            Enter at least two characters to find music.
          </p>
        )}
        {loading && (
          <p role="status" className="margin-field-hint">
            Finding music…
          </p>
        )}
        <ul className="margin-music-results" aria-label="Songs">
          {results.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                disabled={pending}
                className="margin-track-choice"
                aria-label={`${selected.has(track.id) ? "Remove" : "Add"} ${track.title} by ${track.artist}`}
                aria-pressed={selected.has(track.id)}
                onClick={() => change(track, selected.has(track.id))}
              >
                <TrackIdentity track={track} />
                {selected.has(track.id) ? (
                  <Check aria-hidden="true" strokeWidth={1.5} />
                ) : (
                  <Plus aria-hidden="true" strokeWidth={1.5} />
                )}
              </button>
              <AppleSongBadge track={track} />
            </li>
          ))}
        </ul>
        {!loading && searched && !results.length && (
          <p className="margin-field-hint">
            No songs match. Try another song or artist.
          </p>
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
      <p role="status" className="margin-status">
        {pending ? "Saving your music…" : status}
      </p>
    </DialogContent>
  );
}
