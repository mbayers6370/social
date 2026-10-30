"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PhotoPicker } from "@/features/gallery/photo-picker";
import { useOptionalPreview } from "@/features/local-preview/provider";
import {
  GALLERY_LIMIT,
  photoLabel,
  previewMessage,
  type Photo,
} from "@/features/local-preview/model";

export function ProfilePhotoEditor() {
  const preview = useOptionalPreview();
  const trigger = useRef<HTMLButtonElement>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState("");
  if (!preview) return null;
  function choose(photo: Photo) {
    setError("");
    setPicking(false);
    setReplacement("");
    setSelected(photo);
  }
  const full =
    selected &&
    !preview.state.gallery.some((entry) => entry.photoId === selected.id) &&
    preview.state.gallery.length >= GALLERY_LIMIT;
  return (
    <>
      <Button
        ref={trigger}
        className="margin-profile-photo-edit"
        variant="ghost"
        size="icon"
        aria-label="Change profile photograph"
        onClick={() => setPicking(true)}
      >
        <Pencil aria-hidden="true" />
      </Button>
      <PhotoPicker
        open={picking}
        onOpenChange={setPicking}
        onChoose={choose}
        context="gallery"
      />
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="margin-profile-photo-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogTitle>Your Profile Photograph</DialogTitle>
          <DialogDescription>
            {full
              ? "Your gallery has twenty photographs. Choose one to replace before using this photograph. Other posts using the replaced photograph stay as they are."
              : "This photograph will appear on your profile and beside your posts. New photographs also take a place in your gallery."}
          </DialogDescription>
          {selected && (
            <Image
              {...selected.image}
              alt={selected.description}
              unoptimized={selected.kind === "local"}
              className="margin-profile-photo-preview"
              sizes="160px"
            />
          )}
          {full && (
            <fieldset className="margin-profile-photo-replacements">
              <legend>Replace a gallery photograph</legend>
              {preview.state.gallery.map((entry) => {
                const photo = preview.state.photos.find(
                  (item) =>
                    item.id === entry.photoId &&
                    item.ownerId === preview.bootstrap.viewerId,
                );
                return (
                  photo && (
                    <label key={photo.id}>
                      <input
                        type="radio"
                        name="portrait-replacement"
                        value={photo.id}
                        checked={replacement === photo.id}
                        onChange={() => setReplacement(photo.id)}
                      />
                      <Image
                        {...photo.image}
                        alt=""
                        sizes="64px"
                        unoptimized={photo.kind === "local"}
                      />
                      <span>{photoLabel(photo)}</span>
                    </label>
                  )
                );
              })}
            </fieldset>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="margin-form-actions">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={!!full && !replacement}
              onClick={() => {
                if (!selected) return;
                try {
                  preview.setProfilePhoto(
                    selected.id,
                    replacement || undefined,
                  );
                  setSelected(null);
                } catch (error) {
                  setError(previewMessage(error));
                }
              }}
            >
              Use Photograph
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
