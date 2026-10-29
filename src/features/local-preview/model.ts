import { z } from "zod";
import type { FeedPost, PostMedia } from "@/features/feed/schema";
import type { ProfilePreviewData } from "@/features/profile/schema";
import type { Friendship } from "@/lib/friend-audience";
import type { LocalNotification } from "@/features/notifications/model";
import { dayKey } from "@/features/feed/format";
import {
  containsPostLink,
  postingEligibility,
  type PostingRecord,
} from "@/lib/platform-rules";

export const GALLERY_LIMIT = 20;
export const FEATURED_LIMIT = 3;
export type Photo = PostMedia & {
  id: string;
  ownerId: string;
  title: string;
  kind: "fixture" | "local";
  fromPostId?: string;
};
export type GalleryEntry = { photoId: string; featured: boolean };
export type GalleryAddition = { photoId: string; createdAt: string };
export function photoLabel(photo: Photo) {
  return photo.kind === "local" ? photo.description : photo.title;
}
export const preferencesSchema = z.strictObject({
  readingSize: z.enum(["standard", "larger", "extra-large"]),
  motion: z.enum(["system", "reduced"]),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export type FriendPost = FeedPost & { audience: "friends" };
export type Bootstrap = {
  galleryAdditions?: GalleryAddition[];
  posts?: FriendPost[];
  notifications?: LocalNotification[];
  postingRecords?: PostingRecord[];
  now: string;
  viewerId: string;
  profiles: ProfilePreviewData[];
  friendships: Friendship[];
  photos: Photo[];
  gallery: GalleryEntry[];
};
export type LocalState = {
  galleryAdditions?: GalleryAddition[];
  friendships: Friendship[];
  postingRecords?: PostingRecord[];
  profiles: ProfilePreviewData[];
  posts: FriendPost[];
  photos: Photo[];
  gallery: GalleryEntry[];
};
export class PreviewError extends Error {}
export function previewMessage(error: unknown) {
  return error instanceof PreviewError
    ? error.message
    : "That couldn’t be completed. Please try again.";
}

export const postInputSchema = z
  .strictObject({
    kind: z.enum(["post", "link"]),
    body: z
      .string()
      .trim()
      .min(1, "Write something before sharing.")
      .max(3000, "Keep your post to 3,000 characters."),
    url: z.string().trim().max(2048),
    photoIds: z
      .array(z.string().min(1).max(100))
      .max(3, "Choose up to three photographs.")
      .optional(),
    replacements: z
      .record(z.string().min(1).max(100), z.string().min(1).max(100))
      .optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.photoIds ?? [];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["photoIds"],
        message: "Choose each photograph only once.",
      });
    const replacements = Object.entries(value.replacements ?? {});
    if (
      replacements.some(([id]) => !ids.includes(id)) ||
      new Set(replacements.map(([, id]) => id)).size !== replacements.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["replacements"],
        message:
          "Choose a different gallery replacement for each new photograph.",
      });
    if (value.kind === "link") {
      let valid = false;
      try {
        const url = new URL(value.url);
        valid = url.protocol === "https:" && !url.username && !url.password;
      } catch {}
      if (!valid)
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message:
            "Enter a complete HTTPS link without a username or password.",
        });
      if (ids.length)
        ctx.addIssue({
          code: "custom",
          path: ["photoIds"],
          message:
            "Link posts contain a plain link. Switch to Post to add a photograph.",
        });
    }
  });
export type PostInput = z.infer<typeof postInputSchema>;
export const emptyDraft: PostInput = { kind: "post", body: "", url: "" };
export function initialLocalState(bootstrap: Bootstrap): LocalState {
  return {
    friendships: bootstrap.friendships,
    postingRecords: bootstrap.postingRecords ?? [],
    profiles: bootstrap.profiles,
    posts: bootstrap.posts ?? [],
    photos: bootstrap.photos,
    gallery: bootstrap.gallery,
    galleryAdditions: bootstrap.galleryAdditions ?? [],
  };
}
export function ownedPhoto(state: LocalState, viewerId: string, id: string) {
  const photo = state.photos.find(
    (item) => item.id === id && item.ownerId === viewerId,
  );
  if (!photo) throw new PreviewError("That photograph is unavailable.");
  return photo;
}
export function placePhoto(
  state: LocalState,
  viewerId: string,
  photoId: string,
  replacement?: string,
  now = new Date(),
): LocalState {
  ownedPhoto(state, viewerId, photoId);
  if (state.gallery.some((entry) => entry.photoId === photoId)) return state;
  const allowance = galleryPhotoEligibility(state, viewerId, now, photoId);
  if (!allowance.allowed) throw new PreviewError(allowance.reason);
  const galleryAdditions = [
    ...(state.galleryAdditions ?? []).filter(
      (record) =>
        record.photoId !== photoId ||
        dayKey(record.createdAt) !== dayKey(now.toISOString()),
    ),
    { photoId, createdAt: now.toISOString() },
  ];
  if (replacement) {
    const index = state.gallery.findIndex(
      (entry) => entry.photoId === replacement,
    );
    if (index < 0)
      throw new PreviewError("Choose a photograph in your gallery to replace.");
    return {
      ...state,
      galleryAdditions,
      gallery: state.gallery.map((entry, position) =>
        position === index ? { photoId, featured: entry.featured } : entry,
      ),
    };
  }
  if (state.gallery.length >= GALLERY_LIMIT)
    throw new PreviewError(
      "Your gallery is full. Choose a photograph to replace.",
    );
  return {
    ...state,
    galleryAdditions,
    gallery: [...state.gallery, { photoId, featured: false }],
  };
}
export function publishLocalPost(
  state: LocalState,
  viewerId: string,
  raw: unknown,
  id: string,
  now: Date,
  replacingId?: string,
): LocalState {
  const original = replacingId
    ? ownedPost(state, viewerId, replacingId, now)
    : undefined;
  const result = postInputSchema.safeParse(raw);
  if (!result.success) throw new PreviewError(result.error.issues[0].message);
  const input = result.data;
  const profile = state.profiles.find((item) => item.person.id === viewerId);
  if (!profile) throw new PreviewError("Your sample profile is unavailable.");
  const eligibility = localPostingEligibility(
    state,
    viewerId,
    now,
    containsPostLink(input),
    input.photoIds?.length ?? 0,
    replacingId,
    input.photoIds,
  );
  if (!eligibility.allowed) throw new PreviewError(eligibility.reason);
  const photos = (input.photoIds ?? []).map((id) =>
    ownedPhoto(state, viewerId, id),
  );
  const photosToPlace = original
    ? photos.filter(
        (photo) =>
          !original.media?.some((media) => media.image.src === photo.image.src),
      )
    : photos;
  const post: FriendPost = {
    id: original?.id ?? id,
    author: profile.person,
    createdAt: original?.createdAt ?? now.toISOString(),
    expiresAt:
      original?.expiresAt ??
      new Date(now.getTime() + 30 * 86400_000).toISOString(),
    paragraphs: [input.body],
    audience: "friends",
    likes: original?.likes ?? 0,
    comments: original?.comments ?? [],
    ...(photos.length
      ? {
          media: photos.map((photo) => ({
            description: photo.description,
            caption: photo.caption,
            aspect: photo.aspect,
            image: photo.image,
          })),
        }
      : {}),
    ...(input.kind === "link"
      ? {
          link: {
            url: input.url,
            title: new URL(input.url).hostname.slice(0, 200),
          },
        }
      : {}),
  };
  const withPost = {
    ...state,
    posts: original
      ? state.posts.map((item) => (item.id === original.id ? post : item))
      : [post, ...state.posts],
  };
  const placed = photosToPlace.reduce(
    (current, photo) =>
      placePhoto(
        current,
        viewerId,
        photo.id,
        input.replacements?.[photo.id],
        now,
      ),
    withPost,
  );
  return {
    ...placed,
    photos: placed.photos.map((item) =>
      photos.some((photo) => photo.id === item.id)
        ? { ...item, fromPostId: item.fromPostId ?? id }
        : item,
    ),
  };
}
export function ownedPost(
  state: LocalState,
  viewerId: string,
  id: string,
  now: Date,
) {
  const post = state.posts.find((item) => item.id === id);
  if (
    !post ||
    post.author.id !== viewerId ||
    Date.parse(post.expiresAt) <= now.getTime()
  )
    throw new PreviewError("That post is unavailable to edit or delete.");
  return post;
}

export function editLocalPost(
  state: LocalState,
  viewerId: string,
  id: string,
  raw: unknown,
  now: Date,
) {
  return publishLocalPost(state, viewerId, raw, id, now, id);
}

export function deleteLocalPost(
  state: LocalState,
  viewerId: string,
  id: string,
  now: Date,
): LocalState {
  ownedPost(state, viewerId, id, now);
  return {
    ...state,
    posts: state.posts.filter((post) => post.id !== id),
    postingRecords: state.postingRecords?.filter((post) => post.id !== id),
    profiles: state.profiles.map((profile) =>
      profile.person.id === viewerId
        ? {
            ...profile,
            recent: profile.recent.filter((post) => post.id !== id),
          }
        : profile,
    ),
  };
}

export function editablePostInput(
  state: LocalState,
  post: FriendPost,
): PostInput {
  return {
    kind: post.link ? "link" : "post",
    body: post.paragraphs.join("\n\n"),
    url: post.link?.url ?? "",
    photoIds: (post.media ?? []).flatMap((media) => {
      const photo = state.photos.find(
        (item) =>
          item.ownerId === post.author.id && item.image.src === media.image.src,
      );
      return photo ? [photo.id] : [];
    }),
  };
}
export function localPostingEligibility(
  state: LocalState,
  viewerId: string,
  now: Date,
  hasLink: boolean,
  imageCount = 0,
  replacingId?: string,
  selectedPhotoIds: readonly (string | undefined)[] = [],
) {
  const records = [
    ...new Map(
      [
        ...(state.postingRecords ?? []),
        ...state.posts.map((post) => ({
          id: post.id,
          authorId: post.author.id,
          createdAt: post.createdAt,
          hasLink: containsPostLink(post),
          imageCount: post.media?.length ?? 0,
        })),
      ].map((record) => [record.id, record]),
    ).values(),
  ];
  const base = postingEligibility(
    records,
    viewerId,
    now,
    hasLink,
    replacingId,
    0,
  );
  const postingDay = dayKey(
    records.find(
      (record) => record.id === replacingId && record.authorId === viewerId,
    )?.createdAt ?? now.toISOString(),
  );
  // A photograph in a post is also placed in Gallery; that is one addition,
  // not a second image. Gallery-only images still consume the shared allowance.
  const galleryOnly = new Set(
    (state.galleryAdditions ?? [])
      .filter((record) => {
        if (
          dayKey(record.createdAt) !== postingDay ||
          selectedPhotoIds.includes(record.photoId)
        )
          return false;
        if (!state.gallery.some((entry) => entry.photoId === record.photoId))
          return false;
        const photo = state.photos.find(
          (item) => item.id === record.photoId && item.ownerId === viewerId,
        );
        return (
          photo &&
          !state.posts.some(
            (post) =>
              post.id !== replacingId &&
              post.author.id === viewerId &&
              dayKey(post.createdAt) === postingDay &&
              post.media?.some((media) => media.image.src === photo.image.src),
          )
        );
      })
      .map((record) => record.photoId),
  ).size;
  const imagesRemaining = Math.max(0, base.imagesRemaining - galleryOnly);
  const allowed = base.allowed && imageCount <= imagesRemaining;
  return {
    ...base,
    imagesRemaining,
    allowed,
    reason: allowed
      ? ""
      : !base.allowed
        ? base.reason
        : `You can add up to three photographs per day across posts and Gallery. ${imagesRemaining} ${imagesRemaining === 1 ? "photograph" : "photographs"} remaining today.`,
  };
}

export function galleryPhotoEligibility(
  state: LocalState,
  viewerId: string,
  now: Date,
  photoId?: string,
) {
  const allowance = localPostingEligibility(state, viewerId, now, false);
  const photo = photoId ? ownedPhoto(state, viewerId, photoId) : undefined;
  const alreadyCounted =
    !!photo &&
    (state.gallery.some((entry) => entry.photoId === photoId) ||
      state.posts.some(
        (post) =>
          post.author.id === viewerId &&
          dayKey(post.createdAt) === dayKey(now.toISOString()) &&
          post.media?.some((media) => media.image.src === photo.image.src),
      ));
  const allowed = alreadyCounted || allowance.imagesRemaining > 0;
  return {
    allowed,
    imagesRemaining: allowance.imagesRemaining,
    reason: allowed
      ? ""
      : "You’ve used today’s three-photo allowance across posts and Gallery. You can add more tomorrow.",
  };
}
export function changeGallery(
  state: LocalState,
  viewerId: string,
  photoId: string,
  action: "remove" | "feature" | "earlier" | "later",
): LocalState {
  ownedPhoto(state, viewerId, photoId);
  const index = state.gallery.findIndex((entry) => entry.photoId === photoId);
  if (index < 0)
    throw new PreviewError("That photograph isn’t in your gallery.");
  const gallery = [...state.gallery];
  if (action === "remove") gallery.splice(index, 1);
  else if (action === "feature") {
    if (
      !gallery[index].featured &&
      gallery.filter((entry) => entry.featured).length >= FEATURED_LIMIT
    )
      throw new PreviewError("You can feature up to three photographs.");
    gallery[index] = { ...gallery[index], featured: !gallery[index].featured };
  } else {
    const step = action === "earlier" ? -1 : 1;
    let next = index + step;
    while (
      next >= 0 &&
      next < gallery.length &&
      gallery[next].featured !== gallery[index].featured
    )
      next += step;
    if (next >= 0 && next < gallery.length)
      [gallery[index], gallery[next]] = [gallery[next], gallery[index]];
  }
  return { ...state, gallery };
}
export function reorderGallery(
  state: LocalState,
  viewerId: string,
  photoId: string,
  targetId: string,
): LocalState {
  ownedPhoto(state, viewerId, photoId);
  ownedPhoto(state, viewerId, targetId);
  return {
    ...state,
    gallery: moveGalleryEntries(state.gallery, photoId, targetId),
  };
}
/** Shared by the visual preview and committed move so their results cannot diverge. */
export function moveGalleryEntries(
  entries: GalleryEntry[],
  photoId: string,
  targetId: string,
): GalleryEntry[] {
  const from = entries.findIndex((entry) => entry.photoId === photoId);
  const to = entries.findIndex((entry) => entry.photoId === targetId);
  if (from < 0 || to < 0)
    throw new PreviewError("Choose photographs in your gallery.");
  if (from === to) return entries;
  const gallery = [...entries];
  if (gallery[from].featured !== gallery[to].featured) {
    // Crossing rows exchanges the two slots without exceeding the featured limit.
    const moving = gallery[from];
    const target = gallery[to];
    gallery[from] = { ...target, featured: moving.featured };
    gallery[to] = { ...moving, featured: target.featured };
  } else {
    const [moving] = gallery.splice(from, 1);
    gallery.splice(to, 0, moving);
  }
  return gallery;
}
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/^@/, "");
export function searchProfiles(
  profiles: readonly ProfilePreviewData[],
  query: string,
) {
  const key = normalize(query.slice(0, 80));
  return key
    ? profiles
        .filter(
          (profile) =>
            normalize(profile.person.name).includes(key) ||
            normalize(profile.handle).includes(key),
        )
        .slice(0, 20)
    : [];
}
