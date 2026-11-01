"use client";
import Image from "next/image";
import { Check, ImagePlus, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
            Select a saved photograph or choose one from your device, then
            review it before continuing. Files stay in this tab.
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
  const {
    register,
    control,
    handleSubmit,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<{ description: string }>({ defaultValues: { description: "" } });
  const description = useWatch({ control, name: "description" });
  function chooseSaved(photo: Photo) {
    setSelection({ kind: "library", id: photo.id });
    setValue("description", photo.description);
    clearErrors();
    setError("");
    if (input.current) input.current.value = "";
  }
  const libraryContent = (
    <section
      className="margin-photo-source"
      aria-labelledby="photo-library-title"
    >
      <h3 id="photo-library-title">Your Photographs</h3>
      {!library.length && (
        <p className="margin-field-hint">No photographs here yet.</p>
      )}
      <div className="margin-photo-library">
        {library.map((photo) => (
          <button
            key={photo.id}
            type="button"
            aria-label={`Select ${photoLabel(photo)}`}
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
                <Check strokeWidth={2.5} />
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
          onSubmit={(event) => {
            event.stopPropagation();
            void handleSubmit(async ({ description }) => {
              setError("");
              if (!selectionAllowed) return;
              if (selectedPhoto) {
                onChoose(selectedPhoto);
                return;
              }
              if (!selectedFile || !allowedRef.current) return;
              try {
                const photo = await preview.upload(selectedFile, description);
                if (alive.current && allowedRef.current) onChoose(photo);
              } catch (error) {
                if (alive.current) setError(previewMessage(error));
              }
            })(event);
          }}
        >
          {selectedFile && (
            <DroppedPhotograph file={selectedFile} description={description} />
          )}
          <Field>
            <Label htmlFor="local-photo">Photograph from your device</Label>
            <div
              className="margin-file-picker"
              data-disabled={isSubmitting || !uploadAllowed || undefined}
            >
              <span className="margin-file-picker-mark" aria-hidden="true">
                <ImagePlus strokeWidth={1.5} />
              </span>
              <div className="margin-file-summary">
                <span className="margin-file-name" role="status">
                  {selectedFile?.name ?? "A photograph from your day"}
                </span>
                <span id="photo-file-hint" className="margin-field-hint">
                  JPEG, PNG or WebP · Up to 8 MB
                </span>
              </div>
              <span className="margin-upload-choose" aria-hidden="true">
                <Upload strokeWidth={1.5} />
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
                  setValue("description", "");
                  clearErrors();
                  setError("");
                }}
              />
            </div>
          </Field>
          <Field>
            <Label htmlFor="photo-description">
              Describe the photograph (alt text)
            </Label>
            <Input
              id="photo-description"
              maxLength={300}
              {...register("description", {
                validate: (value) =>
                  Boolean(value.trim()) ||
                  "Describe the photograph for people who can’t see it.",
                maxLength: 300,
              })}
              readOnly={Boolean(selectedPhoto)}
              disabled={isSubmitting || !selection}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={`photo-description-hint${errors.description ? " photo-description-error" : ""}`}
            />
            <p id="photo-description-hint" className="margin-field-hint">
              {selectedPhoto
                ? "The saved description is preserved when you reuse this photograph."
                : "Describe what’s visible for people using screen readers. Add any story in your post."}
            </p>
            {errors.description && (
              <FieldError id="photo-description-error">
                {errors.description.message}
              </FieldError>
            )}
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
          {isSubmitting ? "Checking photograph…" : "Use Photograph"}
        </Button>
      </footer>
    </>
  );
}
function DroppedPhotograph({
  file,
  description,
}: {
  file: File;
  description: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const src = URL.createObjectURL(file);
    if (image.current) image.current.src = src;
    return () => URL.revokeObjectURL(src);
  }, [file]);
  // This temporary blob exists only in this tab and cannot use image optimization.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image}
      className="margin-dropped-photo"
      alt={
        description.trim() || "Selected photograph; add its description below"
      }
      width={320}
      height={240}
    />
  );
}
