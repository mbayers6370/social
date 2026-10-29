"use client";
import { photoLabel } from "@/features/local-preview/model";
import { PHOTO_ACCEPT } from "@/lib/media-policy";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (photo: Photo) => void;
  context?: "post" | "gallery";
  canChoose?: (photo: Photo) => boolean;
  allowUpload?: boolean;
}) {
  const preview = usePreview();
  const returnTo = useRef<HTMLElement | null>(null);
  const galleryAllowance = galleryPhotoEligibility(
    preview.state,
    preview.bootstrap.viewerId,
    new Date(preview.now),
  );
  const uploadAllowed =
    allowUpload && (context !== "gallery" || galleryAllowance.allowed);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="margin-photo-picker"
        onOpenAutoFocus={() => {
          returnTo.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (returnTo.current?.isConnected)
            returnTo.current.focus({ preventScroll: true });
        }}
      >
        <DialogHeader>
          <DialogTitle>Choose a photograph</DialogTitle>
          <DialogDescription>
            Use a photograph you already have, or choose one from your device.
            Files stay in this tab; nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        {context === "gallery" && (
          <p className="margin-field-hint" role="status">
            {galleryAllowance.imagesRemaining} photographs remaining today
            across posts and Gallery.
          </p>
        )}
        <div className="margin-photo-library">
          {preview.state.photos
            .filter((photo) => photo.ownerId === preview.bootstrap.viewerId)
            .map((photo) => (
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
        <PhotoUpload onChoose={onChoose} disabled={!uploadAllowed} />
      </DialogContent>
    </Dialog>
  );
}
function PhotoUpload({
  onChoose,
  disabled = false,
}: {
  onChoose: (photo: Photo) => void;
  disabled?: boolean;
}) {
  const preview = usePreview();
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ file: FileList; description: string }>();
  return (
    <form
      className="margin-upload-form"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(async (value) => {
          setError("");
          try {
            const photo = await preview.upload(
              value.file[0],
              value.description,
            );
            if (alive.current) onChoose(photo);
          } catch (error) {
            if (alive.current) setError(previewMessage(error));
          }
        })(event);
      }}
    >
      <Field>
        <Label htmlFor="local-photo">Photograph from your device</Label>
        <Input
          id="local-photo"
          type="file"
          accept={PHOTO_ACCEPT}
          {...register("file", { required: "Choose a photograph." })}
          aria-invalid={!!errors.file}
          aria-describedby={`photo-file-hint${errors.file ? " local-photo-error" : ""}`}
          disabled={isSubmitting || disabled}
        />
        <p id="photo-file-hint" className="margin-field-hint">
          JPEG, PNG or WebP · Up to 8 MB
        </p>
        {errors.file && (
          <FieldError id="local-photo-error">{errors.file.message}</FieldError>
        )}
      </Field>
      <Field>
        <Label htmlFor="photo-description">Describe the photograph</Label>
        <Input
          id="photo-description"
          maxLength={300}
          {...register("description", {
            required: "Describe the photograph for people who can’t see it.",
            maxLength: 300,
          })}
          aria-invalid={!!errors.description}
          aria-describedby={
            errors.description ? "photo-description-error" : undefined
          }
          disabled={isSubmitting || disabled}
        />
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
      <Button type="submit" disabled={isSubmitting || disabled}>
        {isSubmitting ? "Checking photograph…" : "Use photograph"}
      </Button>
    </form>
  );
}
