"use client";
import Image from "next/image";
import { DevicePhotoPreview } from "@/components/shared/device-photo-preview";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, Image as ImageIcon, Upload } from "@/components/margin-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateLocalPhoto } from "@/features/local-preview/upload";
import type { PrivatePhoto } from "@/features/social/contracts";
import { useSpaceClient } from "./client";

export type SpaceDraftPhoto =
  | { kind: "saved"; photo: PrivatePhoto }
  | {
      kind: "device";
      file: File;
      description: string;
      width: number;
      height: number;
      src: string;
    };

export function SpacePhotoPicker({
  spaceId = "",
  libraryUrl,
  open,
  initialFile,
  selected,
  onClose,
  onChoose,
  onReturnFocus,
}: {
  spaceId?: string;
  libraryUrl?: string;
  open: boolean;
  initialFile?: File;
  selected: SpaceDraftPhoto[];
  onClose: () => void;
  onChoose: (photo: SpaceDraftPhoto) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className="margin-photo-picker margin-photo-picker-post"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogHeader className="margin-photo-picker-header">
          <DialogTitle>Choose a photograph</DialogTitle>
          <DialogDescription>
            Select a saved photograph or choose one from your device, then
            review it before continuing. Nothing is shared until you publish.
          </DialogDescription>
        </DialogHeader>
        <SpacePhotoSelection
          spaceId={spaceId}
          libraryUrl={libraryUrl}
          initialFile={initialFile}
          selected={selected}
          onChoose={onChoose}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
function SpacePhotoSelection({
  spaceId = "",
  libraryUrl,
  initialFile,
  selected,
  onChoose,
  onClose,
}: {
  spaceId?: string;
  libraryUrl?: string;
  initialFile?: File;
  selected: SpaceDraftPhoto[];
  onChoose: (photo: SpaceDraftPhoto) => void;
  onClose: () => void;
}) {
  const client = useSpaceClient();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState(initialFile);
  const [saved, setSaved] = useState<PrivatePhoto>();
  const [description, setDescription] = useState("");
  const [library, setLibrary] = useState<{
    photos: PrivatePhoto[];
    nextCursor: string | null;
  }>({ photos: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(
    (before?: string, signal?: AbortSignal) => {
      return client
        .request(
          `${libraryUrl ?? `/api/spaces/${spaceId}/photos`}${before ? `?before=${encodeURIComponent(before)}` : ""}`,
          {
            cache: "no-store",
            signal: signal
              ? AbortSignal.any([signal, AbortSignal.timeout(30_000)])
              : AbortSignal.timeout(30_000),
          },
        )
        .then(async (response) => {
          if (!response.ok)
            throw Error("Your photographs could not be loaded.");
          const page: typeof library = await response.json();
          if (alive.current && !signal?.aborted)
            setLibrary((current) => ({
              ...page,
              photos: before
                ? [...current.photos, ...page.photos]
                : page.photos,
            }));
        })
        .catch(() => {
          if (alive.current && !signal?.aborted)
            setError(
              "Your photographs could not be loaded. You can still choose one from your device.",
            );
        })
        .finally(() => {
          if (alive.current && !signal?.aborted) setLoading(false);
        });
    },
    [client, spaceId, libraryUrl],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(undefined, controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <>
      <div className="margin-photo-picker-body">
        <section className="margin-photo-source" aria-label="Your Photographs">
          <h3>Your Photographs</h3>
          {loading && <p role="status">Loading photographs…</p>}
          {!loading && !error && !library.photos.length && (
            <p className="margin-field-hint">No photographs here yet.</p>
          )}
          <div className="margin-photo-library">
            {library.photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                aria-label={`Select ${photo.description}`}
                aria-pressed={saved?.id === photo.id}
                disabled={
                  checking ||
                  selected.some(
                    (item) =>
                      item.kind === "saved" && item.photo.id === photo.id,
                  )
                }
                onClick={() => {
                  setSaved(photo);
                  setFile(undefined);
                  setDescription(photo.description);
                  if (input.current) input.current.value = "";
                  setError("");
                }}
              >
                <Image
                  unoptimized
                  src={client.photoSrc(photo.id)}
                  alt={photo.description}
                  width={photo.width}
                  height={photo.height}
                  sizes="160px"
                />
                {saved?.id === photo.id && (
                  <span
                    className="margin-photo-selected-mark"
                    aria-hidden="true"
                  >
                    <Check />
                  </span>
                )}
              </button>
            ))}
          </div>
          {library.nextCursor && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void load(library.nextCursor!);
              }}
            >
              Older photographs
            </Button>
          )}
        </section>
        <form
          id={id}
          className="margin-upload-form"
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (saved) {
              onChoose({ kind: "saved", photo: saved });
              return;
            }
            if (!file || checking) return;
            setChecking(true);
            setError("");
            try {
              const size = await validateLocalPhoto(file, description);
              if (alive.current)
                onChoose({
                  kind: "device",
                  file,
                  description: description.trim(),
                  ...size,
                  src: URL.createObjectURL(file),
                });
            } catch (error) {
              if (alive.current)
                setError(
                  error instanceof Error
                    ? error.message
                    : "That photograph could not be read.",
                );
            } finally {
              if (alive.current) setChecking(false);
            }
          }}
        >
          {file && <DevicePhotoPreview file={file} description={description} />}
          <Label htmlFor={`${id}-file`}>Photograph from your device</Label>
          <div
            className="margin-file-picker"
            data-disabled={checking || undefined}
          >
            <span className="margin-file-picker-mark" aria-hidden="true">
              <ImageIcon />
            </span>
            <div className="margin-file-summary">
              <span className="margin-file-name" role="status">
                {file?.name ?? "A photograph from your day"}
              </span>
              <span className="margin-field-hint">
                JPEG, PNG or WebP · Up to 8 MB
              </span>
            </div>
            <span className="margin-upload-choose" aria-hidden="true">
              <Upload />
              {file ? "Change photograph" : "Choose photograph"}
            </span>
            <input
              ref={input}
              id={`${id}-file`}
              className="margin-upload-native"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={checking}
              onChange={(event) => {
                const next = event.target.files?.[0];
                if (!next) return;
                setFile(next);
                setSaved(undefined);
                setDescription("");
                setError("");
              }}
            />
          </div>
          <Label htmlFor={`${id}-description`}>
            Describe the photograph (alt text)
          </Label>
          <Input
            id={`${id}-description`}
            maxLength={300}
            required
            value={description}
            readOnly={Boolean(saved)}
            disabled={checking || (!file && !saved)}
            onChange={(event) => setDescription(event.target.value)}
          />
          <p className="margin-field-hint">
            {saved
              ? "The saved description is preserved when you reuse this photograph."
              : "Describe what’s visible for people using screen readers. Add any story in your post."}
          </p>
          {error && <p role="alert">{error}</p>}
        </form>
      </div>
      <footer className="margin-photo-picker-footer">
        <Button variant="outline" disabled={checking} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={id}
          disabled={checking || (!saved && !file)}
        >
          {checking ? "Checking photograph…" : "Use Photograph"}
        </Button>
      </footer>
    </>
  );
}
