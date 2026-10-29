import { z } from "zod";
import {
  deleteLocalPhoto,
  FEATURED_LIMIT,
  GALLERY_LIMIT,
  ownedPhoto,
  placePhoto,
  PreviewError,
  type LocalState,
} from "@/features/local-preview/model";

const entry = z.strictObject({
  photoId: z.string().min(1).max(100),
  featured: z.boolean(),
});
const arrangementSchema = z.strictObject({
  base: z.array(entry).max(GALLERY_LIMIT),
  entries: z.array(entry).max(GALLERY_LIMIT),
  deletedPhotoIds: z.array(z.string().min(1).max(100)).max(GALLERY_LIMIT),
  replacement: z
    .strictObject({
      oldPhotoId: z.string().min(1).max(100),
      newPhotoId: z.string().min(1).max(100),
    })
    .optional(),
});
export type GalleryArrangement = z.infer<typeof arrangementSchema>;

/** Validate and commit the whole edit together. A failed edit never changes the source state. */
export function saveGalleryArrangement(
  state: LocalState,
  viewerId: string,
  raw: unknown,
  now: Date,
): LocalState {
  const parsed = arrangementSchema.safeParse(raw);
  if (!parsed.success)
    throw new PreviewError(
      "Choose up to twenty photographs and three featured photographs.",
    );
  const { base, entries, deletedPhotoIds, replacement } = parsed.data;
  base.forEach((entry) => ownedPhoto(state, viewerId, entry.photoId));
  if (
    base.length !== state.gallery.length ||
    base.some(
      (entry, index) =>
        entry.photoId !== state.gallery[index]?.photoId ||
        entry.featured !== state.gallery[index]?.featured,
    )
  )
    throw new PreviewError(
      "Your gallery changed. Close and reopen the editor to continue.",
    );
  const ids = new Set(entries.map((item) => item.photoId));
  const baseIds = new Set(base.map((item) => item.photoId));
  const deleted = new Set(deletedPhotoIds);
  if (ids.size !== entries.length || deleted.size !== deletedPhotoIds.length)
    throw new PreviewError("Choose each photograph only once.");
  if (entries.filter((item) => item.featured).length > FEATURED_LIMIT)
    throw new PreviewError("You can feature up to three photographs.");
  entries.forEach((item) => ownedPhoto(state, viewerId, item.photoId));
  deleted.forEach((id) => {
    ownedPhoto(state, viewerId, id);
    if (!baseIds.has(id) || ids.has(id))
      throw new PreviewError("Choose a gallery photograph to delete.");
  });
  if (
    replacement &&
    (base.length !== GALLERY_LIMIT ||
      !baseIds.has(replacement.oldPhotoId) ||
      baseIds.has(replacement.newPhotoId) ||
      !ids.has(replacement.newPhotoId) ||
      ids.has(replacement.oldPhotoId) ||
      deleted.has(replacement.oldPhotoId))
  )
    throw new PreviewError(
      "Choose a photograph to replace in your full gallery.",
    );
  if (
    base.some(
      (item) =>
        !ids.has(item.photoId) &&
        !deleted.has(item.photoId) &&
        replacement?.oldPhotoId !== item.photoId,
    )
  )
    throw new PreviewError(
      "A photograph can only leave the gallery through Delete or a confirmed replacement.",
    );
  let next = deletedPhotoIds.reduce(
    (current, id) =>
      current.photos.some((photo) => photo.id === id)
        ? deleteLocalPhoto(current, viewerId, id)
        : current,
    state,
  );
  for (const item of entries) {
    ownedPhoto(next, viewerId, item.photoId);
    if (!next.gallery.some((current) => current.photoId === item.photoId))
      next = placePhoto(
        next,
        viewerId,
        item.photoId,
        replacement?.newPhotoId === item.photoId
          ? replacement.oldPhotoId
          : undefined,
        now,
      );
  }
  return { ...next, gallery: entries };
}
