"use client";
import { photoLabel } from "@/features/local-preview/model";
import { PHOTO_ACCEPT } from "@/lib/media-policy";
import Image from "next/image";
import { ImagePlus, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  previewMessage,
  galleryPhotoEligibility,
  type Photo,
} from "@/features/local-preview/model";

export function PhotoPicker({
  open,
  onOpenChange,
  onChoose,
  context = "post",
  canChoose,
  allowUpload = true,
  initialFile,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (photo: Photo) => void;
  context?: "post" | "gallery";
  canChoose?: (photo: Photo) => boolean;
  allowUpload?: boolean;
  initialFile?: File;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const preview = usePreview();
  const returnTo = useRef<HTMLElement | null>(null);
  const library = preview.state.photos.filter(
    (photo) => photo.ownerId === preview.bootstrap.viewerId,
  );
  const galleryAllowance = galleryPhotoEligibility(
    preview.state,
    preview.bootstrap.viewerId,
    new Date(preview.now),
  );
  const uploadAllowed =
    allowUpload && (context !== "gallery" || galleryAllowance.allowed);
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
            type="button"
            key={photo.id}
            onClick={() => onChoose(photo)}
            aria-label={`Use ${photoLabel(photo)}`}
            disabled={
              canChoose
                ? !canChoose(photo)
                : context === "gallery" &&
                  !galleryPhotoEligibility(
                    preview.state,
                    preview.bootstrap.viewerId,
                    new Date(preview.now),
                    photo.id,
                  ).allowed
            }
          >
            <Image
              {...photo.image}
              alt={photo.description}
              unoptimized={photo.kind === "local"}
              sizes="160px"
              loading="eager"
            />
          </button>
        ))}
      </div>
    </section>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "margin-photo-picker",
          context === "gallery" && "margin-photo-picker-gallery",
        )}
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
        <DialogHeader>
          <DialogTitle>Choose a photograph</DialogTitle>
          <DialogDescription>
            {initialFile
              ? "Your photograph is selected. Add a description to continue your post."
              : "Use a photograph you already have, or choose one from your device."}{" "}
            Files stay in this tab; nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        {context === "gallery" && (
          <p className="margin-field-hint" role="status">
            {galleryAllowance.imagesRemaining} photographs remaining today
            across posts and Gallery. Adding here does not use a post slot or
            publish to Feed.
          </p>
        )}
        <PhotoUpload
          onChoose={onChoose}
          disabled={!uploadAllowed}
          initialFile={initialFile}
          library={libraryContent}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
function PhotoUpload({
  onChoose,
  disabled = false,
  initialFile,
  library,
  onCancel,
}: {
  onChoose: (photo: Photo) => void;
  disabled?: boolean;
  initialFile?: File;
  library: ReactNode;
  onCancel: () => void;
}) {
  const formId = useId();
  const preview = usePreview();
  const [error, setError] = useState("");
  const alive = useRef(true);
  const allowed = useRef(!disabled);
  useEffect(() => {
    allowed.current = !disabled;
  }, [disabled]);
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
    formState: { errors, isSubmitting },
  } = useForm<{ file: FileList | File[]; description: string }>({
    defaultValues: { file: initialFile ? [initialFile] : [], description: "" },
  });
  const selectedFile = useWatch({ control, name: "file" })?.[0] ?? initialFile;
  return (
    <>
      {!initialFile && library}
      <form
        id={formId}
        className="margin-upload-form"
        noValidate
        onSubmit={(event) => {
          void handleSubmit(async (value) => {
            setError("");
            try {
              if (!allowed.current) return;
              const file = value.file?.[0] ?? initialFile;
              if (!file) {
                setError("Choose a photograph.");
                return;
              }
              const photo = await preview.upload(file, value.description);
              if (alive.current && allowed.current) onChoose(photo);
            } catch (error) {
              if (alive.current) setError(previewMessage(error));
            }
          })(event);
        }}
      >
        {initialFile && selectedFile && (
          <DroppedPhotograph file={selectedFile} />
        )}
        <Field>
          <Label htmlFor="local-photo">Photograph from your device</Label>
          <div
            className="margin-file-picker"
            data-disabled={isSubmitting || disabled || undefined}
            data-invalid={!!errors.file || undefined}
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
              className="margin-upload-native"
              id="local-photo"
              type="file"
              accept={PHOTO_ACCEPT}
              {...register("file", {
                validate: (files) =>
                  !!(files?.[0] ?? initialFile) || "Choose a photograph.",
              })}
              aria-invalid={!!errors.file}
              aria-describedby={`photo-file-hint${errors.file ? " local-photo-error" : ""}`}
              disabled={isSubmitting || disabled}
            />
          </div>
          {errors.file && (
            <FieldError id="local-photo-error">
              {errors.file.message}
            </FieldError>
          )}
        </Field>
        <Field>
          <Label htmlFor="photo-description">
            Describe the photograph (alt text)
          </Label>
          <Input
            id="photo-description"
            maxLength={300}
            {...register("description", {
              required: "Describe the photograph for people who can’t see it.",
              maxLength: 300,
            })}
            aria-invalid={!!errors.description}
            aria-describedby={`photo-description-hint${errors.description ? " photo-description-error" : ""}`}
            disabled={isSubmitting || disabled}
          />
          <p id="photo-description-hint" className="margin-field-hint">
            Describe what’s visible for people using screen readers. Add any
            story in your post.
          </p>
          {errors.description && (
            <FieldError id="photo-description-error">
              {errors.description.message}
            </FieldError>
          )}
        </Field>
        {error && <FieldError>{error}</FieldError>}
        {!isSubmitting && disabled && (
          <p className="margin-field-hint">
            Your photo allowance is full. You can add more tomorrow.
          </p>
        )}
      </form>
      {initialFile && library}
      <footer className="margin-photo-picker-footer">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" form={formId} disabled={isSubmitting || disabled}>
          {isSubmitting ? "Checking photograph…" : "Use Photograph"}
        </Button>
      </footer>
    </>
  );
}

function DroppedPhotograph({ file }: { file: File }) {
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
      alt="Selected photograph; add its description below"
      width={320}
      height={240}
    />
  );
}
