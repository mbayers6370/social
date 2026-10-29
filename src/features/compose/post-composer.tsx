"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  useWatch,
  type Resolver,
  type UseFormSetValue,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ImagePlus, MoreHorizontal, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/features/feed/post-content";
import { PersonLink } from "@/components/shared/person-link";
import { PhotoPicker } from "@/features/gallery/photo-picker";
import { DeletePostButton } from "@/features/profile/delete-post-button";
import { usePreview } from "@/features/local-preview/provider";
import {
  containsPostLink,
  POSTING_TIME_ZONE,
  POSTING_EXCLUSIONS,
} from "@/lib/platform-rules";
import {
  photoLabel,
  GALLERY_LIMIT,
  postInputSchema,
  previewMessage,
  localPostingEligibility,
  editablePostInput,
  type FriendPost,
  type Photo,
  type PostInput,
} from "@/features/local-preview/model";

const resolvePost = zodResolver(postInputSchema);
// Keep inactive fields in the draft; validate and submit only the chosen mode.
const resolveComposer: Resolver<PostInput> = (value, context, options) =>
  resolvePost(
    value.kind === "link"
      ? { ...value, photoIds: [], replacements: {} }
      : { ...value, url: "" },
    context,
    options,
  );

export function PostComposer({
  onComplete,
  startWithPhoto = false,
  initialPhotoFile,
  editingPost,
}: {
  onComplete: () => void;
  startWithPhoto?: boolean;
  initialPhotoFile?: File;
  editingPost?: FriendPost;
}) {
  const preview = usePreview();
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [droppedFile, setDroppedFile] = useState(initialPhotoFile);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<PostInput>({
    resolver: resolveComposer,
    defaultValues: editingPost
      ? editablePostInput(preview.state, editingPost)
      : {
          ...preview.draft,
          kind: startWithPhoto ? "post" : preview.draft.kind,
        },
  });
  const values = useWatch({ control });
  const photoIds = values.kind === "link" ? [] : (values.photoIds ?? []);
  const hasLink = containsPostLink({
    ...values,
    url: values.kind === "link" ? values.url : "",
  });
  const eligibility = localPostingEligibility(
    preview.state,
    preview.bootstrap.viewerId,
    new Date(preview.now),
    hasLink,
    photoIds.length,
    editingPost?.id,
    photoIds,
  );
  const profile = preview.state.profiles.find(
    (item) => item.person.id === preview.bootstrap.viewerId,
  )!;
  const canChoosePhoto = (photo: Photo) =>
    !photoIds.includes(photo.id) &&
    photoIds.length < 3 &&
    localPostingEligibility(
      preview.state,
      preview.bootstrap.viewerId,
      new Date(preview.now),
      hasLink,
      photoIds.length + 1,
      editingPost?.id,
      [...photoIds, photo.id],
    ).allowed;
  const canUploadPhoto =
    eligibility.allowed &&
    photoIds.length < 3 &&
    photoIds.length < eligibility.imagesRemaining;
  const canAddPhoto =
    canUploadPhoto ||
    preview.state.photos.some(
      (photo) =>
        photo.ownerId === preview.bootstrap.viewerId && canChoosePhoto(photo),
    );
  const galleryReplacements = Object.fromEntries(
    Object.entries(values.replacements ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const photos = photoIds.flatMap((id) => {
    const photo = preview.state.photos.find((item) => item.id === id);
    return photo ? [photo] : [];
  });
  const newPhotos = photos.filter(
    (photo) =>
      !editingPost?.media?.some(
        (media) => media.image.src === photo.image.src,
      ) && !preview.state.gallery.some((entry) => entry.photoId === photo.id),
  );
  const replacementsNeeded = newPhotos.slice(
    Math.max(0, GALLERY_LIMIT - preview.state.gallery.length),
  );
  const missingReplacement = replacementsNeeded.some(
    (photo) => !values.replacements?.[photo.id],
  );
  const update: UseFormSetValue<PostInput> = (key, value) => {
    setValue(key, value);
    if (!editingPost) preview.updateDraft({ [key]: value });
  };
  const dateLabel = (value: string) =>
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: POSTING_TIME_ZONE,
    }).format(new Date(value));
  const allowanceDay = editingPost
    ? `for ${dateLabel(editingPost.createdAt)}`
    : "today";
  return (
    <DialogContent
      className="margin-compose-dialog"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        setFocus("body");
        if (startWithPhoto) {
          update("kind", "post");
          if (canAddPhoto) setPicking(true);
        }
      }}
    >
      <header className="margin-compose-header">
        <div className="margin-compose-heading">
          <DialogTitle className="margin-compose-title">
            {editingPost ? "Edit Post" : "New Post"}
          </DialogTitle>
          {editingPost && (
            <details className="margin-compose-options">
              <summary aria-label="Post options" title="Post options">
                <span className="sr-only">Post options</span>
                <MoreHorizontal aria-hidden="true" strokeWidth={1.5} />
              </summary>
              <div>
                <DeletePostButton post={editingPost} onDeleted={onComplete} />
              </div>
            </details>
          )}
        </div>
        <DialogDescription className="sr-only">
          For friends. Local preview only.
        </DialogDescription>
        <div className="margin-compose-author">
          <Avatar person={profile.person} linked onNavigate={onComplete} />
          <div className="margin-compose-author-copy">
            <strong>
              <PersonLink person={profile.person} onNavigate={onComplete}>
                {profile.person.name}
              </PersonLink>
            </strong>
            <span className="margin-note">
              <Users aria-hidden="true" /> Friends ·{" "}
              {editingPost
                ? `Expires ${dateLabel(editingPost.expiresAt)}`
                : "Disappears after 30 days"}
            </span>
          </div>
        </div>
      </header>
      <form
        noValidate
        className="margin-compose-form"
        onSubmit={handleSubmit((value) => {
          try {
            if (editingPost) {
              preview.editPost(editingPost.id, value);
              onComplete();
              return;
            }
            const id = preview.publish(value);
            onComplete();
            router.push(`/?view=profile#${id}`);
          } catch (error) {
            setError("root", { message: previewMessage(error) });
          }
        })}
      >
        <div className="margin-compose-editor">
          <div
            className="margin-compose-modes"
            role="group"
            aria-label="Post type"
          >
            {(["post", "link"] as const).map((kind) => (
              <Button
                type="button"
                variant="ghost"
                key={kind}
                aria-pressed={values.kind === kind}
                onClick={() => {
                  update("kind", kind);
                  clearErrors();
                }}
              >
                {kind === "post" ? "Post" : "Link"}
              </Button>
            ))}
          </div>
          <Field>
            <Label htmlFor="post-body">Your post</Label>
            <textarea
              data-field
              id="post-body"
              rows={5}
              maxLength={3000}
              className="margin-compose-body"
              placeholder="Something worth sharing…"
              {...register("body", {
                onChange: (event) => {
                  if (!editingPost)
                    preview.updateDraft({ body: event.target.value });
                },
              })}
              aria-invalid={!!errors.body}
              aria-describedby={errors.body ? "post-body-error" : undefined}
            />
            {errors.body && (
              <FieldError id="post-body-error">
                {errors.body.message}
              </FieldError>
            )}
          </Field>
          {values.kind === "link" && (
            <Field>
              <Label htmlFor="post-link">Link</Label>
              <Input
                id="post-link"
                type="url"
                placeholder="https://example.com/article"
                {...register("url", {
                  onChange: (event) => {
                    if (!editingPost)
                      preview.updateDraft({ url: event.target.value });
                  },
                })}
                aria-invalid={!!errors.url}
                aria-describedby={`post-link-hint${errors.url ? " post-link-error" : ""}`}
              />
              <p id="post-link-hint" className="margin-field-hint">
                Appears as a plain link. No preview is fetched.
              </p>
              {errors.url && (
                <FieldError id="post-link-error">
                  {errors.url.message}
                </FieldError>
              )}
            </Field>
          )}
          {photos.length > 0 && (
            <div className="margin-compose-photos">
              {photos.map((photo, index) => (
                <div className="margin-compose-photo" key={photo.id}>
                  <Image
                    {...photo.image}
                    alt={photo.description}
                    unoptimized={photo.kind === "local"}
                    loading="eager"
                    sizes="200px"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    aria-label={`Remove photograph ${index + 1} from draft`}
                    onClick={() => {
                      update(
                        "photoIds",
                        photoIds.filter((id) => id !== photo.id),
                      );
                      const replacements = { ...galleryReplacements };
                      delete replacements[photo.id];
                      update("replacements", replacements);
                    }}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {replacementsNeeded.map((photo) => (
            <div className="margin-compose-replace" key={photo.id}>
              <p>
                Your gallery is full. Choose a photograph to replace with{" "}
                {photoLabel(photo)}. It stays in any existing posts.
              </p>
              <Label htmlFor={`replace-${photo.id}`}>
                Photograph to replace
              </Label>
              <select
                data-field
                id={`replace-${photo.id}`}
                value={values.replacements?.[photo.id] ?? ""}
                onChange={(event) => {
                  const replacements = { ...galleryReplacements };
                  if (event.target.value)
                    replacements[photo.id] = event.target.value;
                  else delete replacements[photo.id];
                  update("replacements", replacements);
                }}
              >
                <option value="">Choose a photograph</option>
                {preview.state.gallery.map((entry) => {
                  const photograph = preview.state.photos.find(
                    (item) => item.id === entry.photoId,
                  );
                  return (
                    <option
                      value={entry.photoId}
                      key={entry.photoId}
                      disabled={Object.entries(values.replacements ?? {}).some(
                        ([id, target]) =>
                          id !== photo.id && target === entry.photoId,
                      )}
                    >
                      {photograph ? photoLabel(photograph) : "Photograph"}
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
          {errors.photoIds && (
            <FieldError>{errors.photoIds.message}</FieldError>
          )}
          {errors.root && <FieldError>{errors.root.message}</FieldError>}
          <div className="margin-compose-footer">
            {values.kind === "post" && (
              <Button
                type="button"
                variant="ghost"
                disabled={!canAddPhoto}
                onClick={() => setPicking(true)}
              >
                <ImagePlus aria-hidden="true" />
                Add photograph
              </Button>
            )}
          </div>
          <div className="margin-compose-guidance">
            <div className="margin-compose-allowances">
              <p
                className="margin-field-hint"
                id="posting-allowance"
                aria-live="polite"
              >
                {eligibility.allowed
                  ? hasLink
                    ? "This link-containing post will be your only post today."
                    : `${eligibility.regularRemaining} regular ${eligibility.regularRemaining === 1 ? "post" : "posts"} remaining ${allowanceDay}.`
                  : eligibility.reason}
              </p>
              <p
                className="margin-field-hint"
                id="photo-allowance"
                aria-live="polite"
              >
                {Math.max(0, eligibility.imagesRemaining - photoIds.length)}{" "}
                photographs remaining {allowanceDay}.
              </p>
            </div>
            <details className="margin-compose-rules">
              <summary>
                Posting guidelines{" "}
                <ChevronDown aria-hidden="true" strokeWidth={1.5} />
              </summary>
              <div>
                {editingPost && (
                  <p>
                    Editing keeps the original date and expiry. Allowances apply
                    to the original posting day.
                  </p>
                )}
                <ul>
                  <li>
                    Up to three regular posts, or one link-containing post as
                    your only post that day.
                  </li>
                  <li>
                    Up to three photographs per day, shared by posts and
                    Gallery.
                  </li>
                  <li>{POSTING_EXCLUSIONS}</li>
                </ul>
                <p>Resets at midnight in {POSTING_TIME_ZONE}.</p>
                <p>
                  Local preview: posts stay in this tab and reset on refresh.
                </p>
              </div>
            </details>
          </div>
        </div>
        <div className="margin-compose-actions">
          <div className="margin-form-actions">
            <Button variant="ghost" type="button" onClick={onComplete}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || !eligibility.allowed || missingReplacement
              }
              aria-describedby="posting-allowance photo-allowance"
            >
              {editingPost
                ? isSubmitting
                  ? "Saving…"
                  : "Save changes"
                : isSubmitting
                  ? "Sharing…"
                  : "Share with friends"}
            </Button>
          </div>
        </div>
      </form>
      <PhotoPicker
        initialFile={droppedFile}
        canChoose={canChoosePhoto}
        allowUpload={canUploadPhoto}
        open={picking}
        onOpenChange={(open) => {
          setPicking(open);
          if (!open) setDroppedFile(undefined);
        }}
        onChoose={(photo) => {
          if (canChoosePhoto(photo))
            update("photoIds", [...photoIds, photo.id]);
          setPicking(false);
          setDroppedFile(undefined);
        }}
      />
    </DialogContent>
  );
}
