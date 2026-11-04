"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { DevicePhotoPreview } from "@/components/shared/device-photo-preview";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSpaceClient } from "@/features/spaces/client";
import { PHOTO_MAX_BYTES } from "@/lib/media-policy";
import {
  MemberRequestError,
  memberChanged,
  requestMember,
} from "./member-client";
import type { PrivatePhoto } from "./contracts";

export function MemberPhotoPicker({
  open,
  onOpenChange,
  photos,
  portrait = false,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: PrivatePhoto[];
  portrait?: boolean;
  onChoose: (photo: PrivatePhoto) => void | Promise<void>;
}) {
  const client = useSpaceClient();
  const id = useId();
  const [file, setFile] = useState<File>();
  const [selected, setSelected] = useState<PrivatePhoto | null>(null);
  const [replacement, setReplacement] = useState("");
  const [working, setWorking] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function choose(photo: PrivatePhoto) {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      await onChoose(photo);
      onOpenChange(false);
      setSelected(null);
      setFile(undefined);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Couldn’t use this photograph. Please try again.",
      );
    } finally {
      setWorking(false);
      lock.current = false;
    }
  }
  async function upload(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (lock.current || uncertain) return;
    if (
      !file?.size ||
      file.size > PHOTO_MAX_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPEG, PNG or WebP photograph up to 8 MB.");
      return;
    }
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      const saved = await requestMember<PrivatePhoto>(
        client,
        "/api/gallery/photo",
        {
          method: "POST",
          body: file,
          headers: {
            "Content-Type": file.type,
            ...(replacement ? { "X-Gallery-Replacement": replacement } : {}),
          },
        },
      );
      setSelected(saved);
      setFile(undefined);
      memberChanged();
      if (!portrait) {
        await onChoose(saved);
        onOpenChange(false);
        setSelected(null);
      }
    } catch (error) {
      if (error instanceof MemberRequestError && error.uncertain)
        setUncertain(true);
      setError(
        error instanceof Error
          ? error.message
          : "Your photograph could not be saved.",
      );
    } finally {
      lock.current = false;
      setWorking(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!working) onOpenChange(value);
      }}
    >
      <DialogContent className="margin-photo-picker" showCloseButton={!working}>
        <header className="margin-photo-picker-header">
          <DialogTitle>
            {portrait ? "Your Profile Photograph" : "Add Photograph"}
          </DialogTitle>
          <DialogDescription>
            {portrait
              ? "Choose from your gallery or upload a photograph. Your profile uses a small crop; the original keeps its existing audience."
              : "Add a photograph to your gallery. You can keep twenty photographs, with up to three featured."}
          </DialogDescription>
          <p className="margin-field-hint">
            Photos are checked before others see them.
          </p>
        </header>
        <div className="margin-photo-picker-body">
          {portrait && selected ? (
            <>
              <Image
                unoptimized
                src={client.photoSrc(selected.id)}
                alt={selected.description}
                width={208}
                height={208}
                className="margin-profile-photo-preview"
              />
              <Button disabled={working} onClick={() => void choose(selected)}>
                Use photograph
              </Button>
              <Button
                variant="ghost"
                disabled={working}
                onClick={() => setSelected(null)}
              >
                Choose another photograph
              </Button>
            </>
          ) : (
            <>
              {portrait && photos.length > 0 && (
                <section className="margin-photo-source">
                  <h3>Your photographs</h3>
                  <div className="margin-photo-library">
                    {photos.map((photo, index) => (
                      <button
                        type="button"
                        key={photo.id}
                        disabled={working}
                        aria-label={`Use ${photo.description === "Photograph" ? `photograph ${index + 1}` : photo.description}`}
                        onClick={() => setSelected(photo)}
                      >
                        <Image
                          unoptimized
                          src={client.photoSrc(photo.id)}
                          alt={photo.description}
                          width={160}
                          height={120}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <form className="margin-upload-form" onSubmit={upload}>
                {file && <DevicePhotoPreview file={file} />}
                <Label htmlFor={`${id}-file`}>Photograph</Label>
                <Input
                  id={`${id}-file`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={working || uncertain}
                  onChange={(event) => setFile(event.target.files?.[0])}
                />
                {photos.length >= 20 && (
                  <>
                    <Label htmlFor={`${id}-replacement`}>
                      Replace a gallery photograph
                    </Label>
                    <select
                      id={`${id}-replacement`}
                      required
                      value={replacement}
                      onChange={(event) => setReplacement(event.target.value)}
                      disabled={working || uncertain}
                    >
                      <option value="">Choose a photograph</option>
                      {photos.map((photo, index) => (
                        <option value={photo.id} key={photo.id}>
                          {photo.description === "Photograph"
                            ? `Photograph ${index + 1}`
                            : photo.description}
                        </option>
                      ))}
                    </select>
                    <p className="margin-field-hint">
                      The replaced photograph remains in posts that use it. Its
                      place in your gallery goes to the new photograph.
                    </p>
                  </>
                )}
                <p className="margin-field-hint">
                  JPEG, PNG or WebP, up to 8 MB. Uploads share your daily
                  allowance of three photographs.
                </p>
                <Button type="submit" disabled={working || uncertain || !file}>
                  {working ? "Uploading…" : "Upload photograph"}
                </Button>
              </form>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          {uncertain && (
            <a href="/app/gallery">Check your gallery before uploading again</a>
          )}
        </div>
        <footer className="margin-photo-picker-footer">
          <Button
            variant="outline"
            disabled={working}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
