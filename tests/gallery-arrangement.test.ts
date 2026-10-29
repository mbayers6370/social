// @vitest-environment node
import { expect, it } from "vitest";
import {
  saveGalleryArrangement,
  type GalleryArrangement,
} from "@/features/gallery/arrangement";
import { initialLocalState, type Photo } from "@/features/local-preview/model";
import { notificationFixture } from "./helpers/notification-fixture";
function fixture() {
  const data = notificationFixture().bootstrap;
  data.photos = Array.from({ length: 4 }, (_, index): Photo => ({
    id: `photo-${index}`,
    ownerId: "ines",
    title: `Photograph ${index}`,
    description: "A quiet morning",
    caption: "Morning",
    aspect: "landscape",
    image: {
      src: `/_next/static/media/photo-${index}.jpg`,
      width: 640,
      height: 480,
    },
    kind: "fixture",
  }));
  data.gallery = data.photos
    .slice(0, 3)
    .map((photo) => ({ photoId: photo.id, featured: true }));
  const state = initialLocalState(data);
  const input: GalleryArrangement = {
    base: state.gallery,
    entries: state.gallery.map((entry) => ({ ...entry })),
    deletedPhotoIds: [],
  };
  return { state, input, now: new Date(data.now) };
}
it("saves order and featured changes as one validated edit and leaves its source untouched", () => {
  const { state, input, now } = fixture();
  const before = structuredClone(state);
  input.entries = [
    input.entries[2],
    { ...input.entries[0], featured: false },
    input.entries[1],
  ];
  const next = saveGalleryArrangement(state, "ines", input, now);
  expect(next.gallery.map((entry) => entry.photoId)).toEqual([
    "photo-2",
    "photo-0",
    "photo-1",
  ]);
  expect(next.gallery[1].featured).toBe(false);
  expect(state).toEqual(before);
});
it("rejects stale, duplicate, over-featured, foreign, and unconfirmed removal edits atomically", () => {
  const { state, input, now } = fixture();
  const before = structuredClone(state);
  const cases = [
    { ...input, base: [] },
    { ...input, entries: [input.entries[0], input.entries[0]] },
    {
      ...input,
      entries: [...input.entries, { photoId: "photo-3", featured: true }],
    },
    { ...input, entries: input.entries.slice(1) },
    { ...input, deletedPhotoIds: ["photo-0"] },
    { ...input, entries: [{ photoId: "missing", featured: false }] },
    { ...input, recipient: "other" },
  ];
  for (const value of cases) {
    expect(() => saveGalleryArrangement(state, "ines", value, now)).toThrow();
    expect(state).toEqual(before);
  }
  expect(() => saveGalleryArrangement(state, "theo", input, now)).toThrow(
    "unavailable",
  );
  expect(state).toEqual(before);
});
it("rejects an exhausted daily allowance without applying the rest of the edit", () => {
  const { state, input, now } = fixture();
  state.postingRecords = [
    {
      id: "post-today",
      authorId: "ines",
      createdAt: now.toISOString(),
      hasLink: false,
      imageCount: 3,
    },
  ];
  const before = structuredClone(state);
  input.entries = [
    { ...input.entries[2], featured: false },
    input.entries[0],
    input.entries[1],
    { photoId: "photo-3", featured: false },
  ];
  expect(() => saveGalleryArrangement(state, "ines", input, now)).toThrow(
    "three-photo allowance",
  );
  expect(state).toEqual(before);
});
it("applies confirmed deletions and additions together, without leaving deleted aliases in the library", () => {
  const { state, input, now } = fixture();
  state.photos.push({ ...state.photos[0], id: "alias" });
  state.gallery.push({ photoId: "alias", featured: false });
  input.base = state.gallery;
  input.deletedPhotoIds = ["photo-0", "alias"];
  input.entries = [
    { photoId: "photo-1", featured: true },
    { photoId: "photo-2", featured: true },
    { photoId: "photo-3", featured: false },
  ];
  const next = saveGalleryArrangement(state, "ines", input, now);
  expect(next.gallery.map((entry) => entry.photoId)).toEqual([
    "photo-1",
    "photo-2",
    "photo-3",
  ]);
  expect(next.photos.map((photo) => photo.id)).toEqual([
    "photo-1",
    "photo-2",
    "photo-3",
  ]);
  expect(state.photos).toHaveLength(5);
});
