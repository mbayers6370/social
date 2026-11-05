"use client";
import Image from "next/image";
import { DevicePhotoPreview } from "@/components/shared/device-photo-preview";
import { Check, Image as ImageIcon, Upload } from "@/components/margin-icons";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePreview } from "@/features/local-preview/provider";
import {
  photoLabel,
  previewMessage,
  galleryPhotoEligibility,
  type Photo,
} from "@/features/local-preview/model";
import { PHOTO_ACCEPT } from "@/lib/media-policy";

type PickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (photo: Photo) => void;
  context?: "post" | "gallery";
  canChoose?: (photo: Photo) => boolean;
  allowUpload?: boolean;
  initialFile?: File;
  onCloseAutoFocus?: (event: Event) => void;
};
export function PhotoPicker({
  open,
  onOpenChange,
  onCloseAutoFocus,
  ...props
}: PickerProps) {
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`margin-photo-picker margin-photo-picker-${props.context ?? "post"}`}
        onOpenAutoFocus={() => {
          returnTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          if (onCloseAutoFocus) {
            onCloseAutoFocus(event);
            return;
          }
          event.preventDefault();
          if (returnTo.current?.isConnected)
            returnTo.current.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="margin-photo-picker-header">
          <DialogTitle>Choose a photograph</DialogTitle>
          <DialogDescription>
            {props.context === "gallery"
              ? "Choose a saved photo or upload one."
              : "Choose a saved photo or upload one. Nothing is shared until you publish."}
          </DialogDescription>
        </DialogHeader>
        <PhotoSelection {...props} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
type Selection =
  { kind: "library"; id: string } | { kind: "device"; file: File } | null;
function PhotoSelection({
  onChoose,
  context = "post",
  canChoose,
  allowUpload = true,
  initialFile,
  onCancel,
}: Omit<PickerProps, "open" | "onOpenChange" | "onCloseAutoFocus"> & {
  onCancel: () => void;
}) {
  const preview = usePreview();
  const formId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<Selection>(
    initialFile ? { kind: "device", file: initialFile } : null,
  );
  const [error, setError] = useState("");
  const alive = useRef(true);
  const library = preview.state.photos.filter(
    (photo) => photo.ownerId === preview.bootstrap.viewerId,
  );
  const selectedPhoto =
    selection?.kind === "library"
      ? library.find((photo) => photo.id === selection.id)
      : undefined;
  const selectedFile =
    selection?.kind === "device" ? selection.file : undefined;
  const allowance = galleryPhotoEligibility(
    preview.state,
    preview.bootstrap.viewerId,
    new Date(preview.now),
  );
  const uploadAllowed =
    allowUpload && (context !== "gallery" || allowance.allowed);
  const allowed = (photo: Photo) =>
    canChoose
      ? canChoose(photo)
      : context !== "gallery" ||
        galleryPhotoEligibility(
          preview.state,
          preview.bootstrap.viewerId,
          new Date(preview.now),
          photo.id,
        ).allowed;
  const selectionAllowed = selectedPhoto
    ? allowed(selectedPhoto)
    : Boolean(selectedFile && uploadAllowed);
  const allowedRef = useRef(uploadAllowed);
  useEffect(() => {
    allowedRef.current = uploadAllowed;
  }, [uploadAllowed]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [isSubmitting, setSubmitting] = useState(false);
  function chooseSaved(photo: Photo) {
    setSelection({ kind: "library", id: photo.id });
    setError("");
    if (input.current) input.current.value = "";
  }
  const libraryContent = (
    <section
      className="margin-photo-source"
      aria-labelledby="photo-library-title"
    >
      <h3 id="photo-library-title">Your photographs</h3>
      {!library.length && (
        <p className="margin-field-hint">No photographs here yet.</p>
      )}
      <div className="margin-photo-library">
        {library.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Select ${photoLabel(photo) === "Photograph" ? `photograph ${index + 1}` : photoLabel(photo)}`}
            aria-pressed={selectedPhoto?.id === photo.id}
            disabled={isSubmitting || !allowed(photo)}
            onClick={() => chooseSaved(photo)}
          >
            <Image
              {...photo.image}
              alt={photo.description}
              unoptimized={photo.kind === "local"}
              sizes="160px"
              loading="eager"
            />
            {selectedPhoto?.id === photo.id && (
              <span className="margin-photo-selected-mark" aria-hidden="true">
                <Check />
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <>
      {context === "gallery" && (
        <p className="margin-field-hint" role="status">
          {allowance.imagesRemaining} photographs remaining today across posts
          and Gallery. Adding here does not use a post slot or publish to Feed.
        </p>
      )}
      <div className="margin-photo-picker-body">
        {!initialFile && libraryContent}
        <form
          id={formId}
          className="margin-upload-form"
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isSubmitting || !selectionAllowed) return;
            setError("");
            if (selectedPhoto) {
              onChoose(selectedPhoto);
              return;
            }
            if (!selectedFile || !allowedRef.current) return;
            setSubmitting(true);
            try {
              const photo = await preview.upload(selectedFile);
              if (alive.current && allowedRef.current) onChoose(photo);
            } catch (error) {
              if (alive.current) setError(previewMessage(error));
            } finally {
              if (alive.current) setSubmitting(false);
            }
          }}
        >
          {selectedFile && <DevicePhotoPreview file={selectedFile} />}
          <Field>
            <Label htmlFor="local-photo">Or upload a new one</Label>
            <div
              className="margin-file-picker"
              data-disabled={isSubmitting || !uploadAllowed || undefined}
            >
              <span className="margin-file-picker-mark" aria-hidden="true">
                <ImageIcon />
              </span>
              <div className="margin-file-summary">
                <span className="margin-file-name" role="status">
                  {selectedFile?.name ?? "Upload from your device"}
                </span>
                <span id="photo-file-hint" className="margin-field-hint">
                  JPEG, PNG or WebP · Up to 8 MB
                </span>
              </div>
              <span className="margin-upload-choose" aria-hidden="true">
                <Upload />
                {selectedFile ? "Change photograph" : "Choose photograph"}
              </span>
              <input
                ref={input}
                className="margin-upload-native"
                id="local-photo"
                type="file"
                accept={PHOTO_ACCEPT}
                aria-describedby="photo-file-hint"
                disabled={isSubmitting || !uploadAllowed}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setSelection({ kind: "device", file });
                  setError("");
                }}
              />
            </div>
          </Field>
          {error && <FieldError>{error}</FieldError>}
          {!uploadAllowed && (
            <p className="margin-field-hint">
              New photographs are unavailable with your current allowance. You
              can still select an eligible saved photograph.
            </p>
          )}
        </form>
        {initialFile && libraryContent}
      </div>
      <footer className="margin-photo-picker-footer">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={formId}
          disabled={isSubmitting || !selectionAllowed}
        >
          {isSubmitting ? "Checking photograph…" : "Use photograph"}
        </Button>
      </footer>
    </>
  );
}
