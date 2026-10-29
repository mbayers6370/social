// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { canReadFriendsPost } from "@/lib/friend-audience";
import { getDevelopmentSocial } from "@/server/fixtures/social";
import {
  changeGallery,
  reorderGallery,
  initialLocalState,
  placePhoto,
  postInputSchema,
  publishLocalPost,
  editLocalPost,
  deleteLocalPost,
  deleteLocalPhoto,
  editablePostInput,
  localPostingEligibility,
  galleryPhotoEligibility,
  searchProfiles,
  type LocalState,
} from "@/features/local-preview/model";
import { validateLocalPhoto } from "@/features/local-preview/upload";
import { getListeningLinks } from "@/features/profile/music-links";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function fixture() {
  vi.stubEnv("NODE_ENV", "development");
  const bootstrap = getDevelopmentSocial();
  return { bootstrap, state: initialLocalState(bootstrap) };
}
const input = { kind: "post", body: "A quiet afternoon.", url: "" };
const now = new Date("2026-10-28T20:00:00Z");

describe("friend audience policy", () => {
  it("allows the author and accepted friends in either direction, and denies everyone else", () => {
    const friendships = [
      {
        people: ["ines", "theo"] as [string, string],
        status: "accepted" as const,
      },
    ];
    expect(canReadFriendsPost("ines", "ines", [])).toBe(true);
    expect(canReadFriendsPost("theo", "ines", friendships)).toBe(true);
    expect(canReadFriendsPost("ines", "theo", friendships)).toBe(true);
    for (const viewer of [null, "", " ", "stranger"])
      expect(canReadFriendsPost(viewer, "ines", friendships)).toBe(false);
    expect(
      canReadFriendsPost("theo", "ines", [
        { ...friendships[0], status: "pending" },
      ]),
    ).toBe(false);
    expect(
      canReadFriendsPost("theo", "ines", [
        ...friendships,
        { ...friendships[0], status: "blocked" },
      ]),
    ).toBe(false);
  });
});
describe("isolated local application", () => {
  it("uses a photo allowance for a gallery addition without consuming a post slot or creating a feed post", () => {
    const { state } = fixture();
    const base = {
      ...state,
      posts: [],
      postingRecords: [],
      gallery: [],
      galleryAdditions: [],
    };
    const next = placePhoto(base, "ines", state.photos[0].id, undefined, now);
    expect(next.posts).toBe(base.posts);
    expect(localPostingEligibility(next, "ines", now, false)).toMatchObject({
      regularRemaining: 3,
      imagesRemaining: 2,
    });
  });
  it("deletes an owned photograph and its aliases from every owned surface while keeping other photos, post text and discussions", () => {
    const { state } = fixture();
    const original = state.posts.find((post) => post.id === "post-fog")!;
    const photo = state.photos.find(
      (item) => item.image.src === original.media![0].image.src,
    )!;
    const alias = { ...photo, id: "alias" };
    const otherOwner = { ...photo, id: "theos-photo", ownerId: "theo" };
    const otherPost = {
      ...original,
      id: "post-theo-copy",
      author: state.profiles.find((profile) => profile.person.id === "theo")!
        .person,
    };
    const before = {
      ...state,
      photos: [...state.photos, alias, otherOwner],
      gallery: [...state.gallery, { photoId: alias.id, featured: false }],
      posts: [...state.posts, otherPost],
    };
    const next = deleteLocalPhoto(before, "ines", photo.id);
    const edited = next.posts.find((post) => post.id === original.id)!;
    expect(edited).toMatchObject({
      id: original.id,
      paragraphs: original.paragraphs,
      comments: original.comments,
      likes: original.likes,
      createdAt: original.createdAt,
      expiresAt: original.expiresAt,
    });
    expect(edited.media).toEqual(original.media!.slice(1));
    expect(
      next.photos.some((item) => item.id === photo.id || item.id === alias.id),
    ).toBe(false);
    expect(
      next.gallery.some(
        (entry) => entry.photoId === photo.id || entry.photoId === alias.id,
      ),
    ).toBe(false);
    expect(next.photos).toContain(otherOwner);
    expect(next.posts.find((post) => post.id === otherPost.id)).toBe(otherPost);
    expect(next.profiles.find((profile) => profile.person.id === "theo")).toBe(
      before.profiles.find((profile) => profile.person.id === "theo"),
    );
    expect(
      localPostingEligibility(next, "ines", new Date(original.createdAt), false)
        .imagesRemaining,
    ).toBe(1);
    expect(
      localPostingEligibility(next, "ines", new Date(original.createdAt), false)
        .regularRemaining,
    ).toBe(
      localPostingEligibility(
        before,
        "ines",
        new Date(original.createdAt),
        false,
      ).regularRemaining,
    );
    expect(original.media).toHaveLength(3);
    expect(before.photos).toContain(photo);
  });
  it("removes the last attachment and profile snapshots without deleting its post", () => {
    const { state } = fixture();
    const photo = state.photos[0];
    const next = deleteLocalPhoto(state, "ines", photo.id);
    const own = next.profiles.find((profile) => profile.person.id === "ines")!;
    expect(own.photos.some((item) => item.image.src === photo.image.src)).toBe(
      false,
    );
    expect(
      own.recent.some((item) => item.image?.image.src === photo.image.src),
    ).toBe(false);
    const before = state.posts.find(
      (post) => post.id === "post-profile-beach",
    )!;
    const after = next.posts.find((post) => post.id === before.id)!;
    expect(after.media).toBeUndefined();
    expect(after.paragraphs).toBe(before.paragraphs);
    expect(next.posts).toHaveLength(state.posts.length);
    expect(
      next.galleryAdditions?.some((entry) => entry.photoId === photo.id),
    ).toBe(false);
    expect(
      next.postingRecords?.find((record) => record.id === before.id)
        ?.imageCount,
    ).toBe(0);
  });
  it("rejects foreign and missing photo identifiers without changing local state", () => {
    const { state } = fixture();
    const snapshot = structuredClone(state);
    expect(() => deleteLocalPhoto(state, "theo", state.photos[0].id)).toThrow(
      "unavailable",
    );
    expect(() => deleteLocalPhoto(state, "ines", "missing-photo")).toThrow(
      "unavailable",
    );
    expect(state).toEqual(snapshot);
  });
  it("shares the daily image allowance between Gallery and posts without double-counting", () => {
    const { state } = fixture();
    const empty = { ...state, gallery: [], galleryAdditions: [] };
    const ids = state.photos.slice(0, 4).map((photo) => photo.id);
    const one = placePhoto(empty, "ines", ids[0], undefined, now);
    const posted = publishLocalPost(
      one,
      "ines",
      { ...input, photoIds: [ids[0]] },
      "post-gallery-shared",
      now,
    );
    expect(
      localPostingEligibility(posted, "ines", now, false).imagesRemaining,
    ).toBe(2);
    const two = placePhoto(posted, "ines", ids[1], undefined, now);
    const three = placePhoto(two, "ines", ids[2], undefined, now);
    expect(galleryPhotoEligibility(three, "ines", now).allowed).toBe(false);
    expect(() => placePhoto(three, "ines", ids[3], undefined, now)).toThrow(
      "three-photo allowance",
    );
    expect(() =>
      publishLocalPost(
        three,
        "ines",
        { ...input, photoIds: [ids[3]] },
        "post-fourth",
        now,
      ),
    ).toThrow("three photographs per day");
    expect(
      publishLocalPost(three, "ines", input, "post-text-only", now).posts[0]
        .media,
    ).toBeUndefined();
  });
  it("lets three Gallery photographs become a post and keeps the shared allowance exhausted", () => {
    const { state } = fixture();
    const ids = state.photos.slice(0, 3).map((photo) => photo.id);
    const gallery = ids.reduce(
      (next, id) => placePhoto(next, "ines", id, undefined, now),
      { ...state, gallery: [], galleryAdditions: [] } as LocalState,
    );
    const next = publishLocalPost(
      gallery,
      "ines",
      { ...input, photoIds: ids },
      "post-gallery-three",
      now,
    );
    expect(next.posts[0].media).toHaveLength(3);
    expect(next.gallery.map((entry) => entry.photoId)).toEqual(ids);
    expect(
      localPostingEligibility(next, "ines", now, false).imagesRemaining,
    ).toBe(0);
    const deleted = deleteLocalPost(next, "ines", "post-gallery-three", now);
    expect(deleted.gallery).toBe(next.gallery);
    expect(
      localPostingEligibility(deleted, "ines", now, false).imagesRemaining,
    ).toBe(0);
  });
  it("automatically places all three post photographs in Gallery and denies a fourth Gallery addition", () => {
    const { state } = fixture();
    const ids = state.photos.slice(0, 4).map((photo) => photo.id);
    const next = publishLocalPost(
      { ...state, gallery: [], galleryAdditions: [] },
      "ines",
      { ...input, photoIds: ids.slice(0, 3) },
      "post-three-new",
      now,
    );
    expect(next.gallery.map((entry) => entry.photoId)).toEqual(ids.slice(0, 3));
    expect(next.galleryAdditions).toHaveLength(3);
    expect(() => placePhoto(next, "ines", ids[3], undefined, now)).toThrow(
      "three-photo allowance",
    );
  });
  it("does not bypass today's shared allowance by adding a new image to an older post", () => {
    const { state } = fixture();
    const ids = state.photos.slice(0, 4).map((photo) => photo.id);
    const full = ids
      .slice(0, 3)
      .reduce((next, id) => placePhoto(next, "ines", id, undefined, now), {
        ...state,
        gallery: [],
        galleryAdditions: [],
      } as LocalState);
    const old = state.posts.find((post) => post.id === "post-profile-beach")!;
    expect(() =>
      editLocalPost(
        full,
        "ines",
        old.id,
        { ...input, photoIds: [ids[3]] },
        now,
      ),
    ).toThrow("three-photo allowance");
    expect(full.posts.find((post) => post.id === old.id)).toBe(old);
  });
  it("edits a canonical post without changing its identity, discussion, expiry or image allowance", () => {
    const { state } = fixture();
    const original = state.posts.find((post) => post.id === "post-fog")!;
    const draft = editablePostInput(state, original);
    expect(draft.photoIds).toHaveLength(3);
    const next = editLocalPost(
      state,
      "ines",
      original.id,
      { ...draft, body: "A revised thought." },
      now,
    );
    const edited = next.posts.find((post) => post.id === original.id)!;
    expect(next.posts).toHaveLength(state.posts.length);
    expect(next.gallery).toBe(state.gallery);
    expect(edited).toMatchObject({
      id: original.id,
      createdAt: original.createdAt,
      expiresAt: original.expiresAt,
      likes: original.likes,
      comments: original.comments,
      media: original.media,
      paragraphs: ["A revised thought."],
    });
    expect(original.paragraphs).not.toEqual(edited.paragraphs);
    expect(
      localPostingEligibility(
        next,
        "ines",
        new Date(original.createdAt),
        false,
        3,
        original.id,
        draft.photoIds,
      ).allowed,
    ).toBe(true);
  });
  it("enforces editing limits on the original posting day and rejects foreign, expired and injected edits", () => {
    const { state } = fixture();
    const post = state.posts.find((post) => post.id === "post-fog")!;
    const draft = editablePostInput(state, post);
    const two = publishLocalPost(
      state,
      "ines",
      input,
      "post-second",
      new Date(post.createdAt),
    );
    expect(() =>
      editLocalPost(
        two,
        "ines",
        post.id,
        { ...draft, body: "https://example.com" },
        now,
      ),
    ).toThrow("only post");
    expect(() => editLocalPost(state, "theo", post.id, draft, now)).toThrow(
      "unavailable",
    );
    expect(() => deleteLocalPost(state, "theo", post.id, now)).toThrow(
      "unavailable",
    );
    expect(() =>
      editLocalPost(
        state,
        "ines",
        post.id,
        { ...draft, authorId: "theo" },
        now,
      ),
    ).toThrow();
    expect(() =>
      deleteLocalPost(state, "ines", post.id, new Date(post.expiresAt)),
    ).toThrow("unavailable");
  });
  it("deletes the canonical post and dated quota record while retaining gallery photographs", () => {
    const { state } = fixture();
    const post = state.posts.find((post) => post.id === "post-fog")!;
    const next = deleteLocalPost(state, "ines", post.id, now);
    expect(next.posts.some((item) => item.id === post.id)).toBe(false);
    expect(next.postingRecords?.some((item) => item.id === post.id)).toBe(
      false,
    );
    expect(
      next.profiles
        .find((profile) => profile.person.id === "ines")
        ?.recent.some((item) => item.id === post.id),
    ).toBe(false);
    expect(next.photos).toBe(state.photos);
    expect(next.gallery).toBe(state.gallery);
    expect(
      localPostingEligibility(next, "ines", new Date(post.createdAt), false)
        .imagesRemaining,
    ).toBe(1);
    expect(state.posts.some((item) => item.id === post.id)).toBe(true);
  });
  it("publishes three photos together, blocks a fourth photo across posts, and still permits text", () => {
    const { state } = fixture();
    const original = structuredClone(state);
    const photoIds = state.photos.slice(0, 3).map((photo) => photo.id);
    const next = publishLocalPost(
      state,
      "ines",
      { ...input, photoIds },
      "post-three",
      now,
    );
    expect(next.posts[0].media).toHaveLength(3);
    expect(() =>
      publishLocalPost(
        next,
        "ines",
        { ...input, photoIds: [photoIds[0]] },
        "post-fourth",
        now,
      ),
    ).toThrow("three photographs per day");
    expect(
      publishLocalPost(next, "ines", input, "post-text", now).posts,
    ).toHaveLength(state.posts.length + 2);
    expect(() =>
      publishLocalPost(
        state,
        "ines",
        { ...input, photoIds: [...photoIds, photoIds[0]] },
        "post-too-many",
        now,
      ),
    ).toThrow("up to three");
    expect(() =>
      publishLocalPost(
        state,
        "ines",
        { ...input, photoIds: [photoIds[0], photoIds[0]] },
        "post-duplicate",
        now,
      ),
    ).toThrow("only once");
    expect(() =>
      publishLocalPost(
        state,
        "ines",
        { ...input, photoIds: [photoIds[0], "missing"] },
        "post-invalid",
        now,
      ),
    ).toThrow("unavailable");
    expect(state).toEqual(original);
  });
  it("never serves its bootstrap outside development", () => {
    for (const environment of ["production", "test"]) {
      vi.stubEnv("NODE_ENV", environment);
      expect(getDevelopmentSocial).toThrow(
        "Development fixtures are unavailable",
      );
    }
  });
  it("counts dated profile and feed fixtures once per canonical post", () => {
    const { bootstrap } = fixture();
    const records = bootstrap.postingRecords!;
    expect(records.filter((post) => post.id === "post-fog")).toHaveLength(1);
    expect(
      records.find((post) => post.id === "post-profile-beach"),
    ).toMatchObject({
      authorId: "ines",
      createdAt: "2026-10-26T15:00:00Z",
    });
    expect(new Set(records.map((post) => post.id)).size).toBe(records.length);
  });
  it("looks up names and handles without ranking or exposing nonfriend content", () => {
    const { bootstrap } = fixture();
    expect(searchProfiles(bootstrap.profiles, " @INES ")[0].person.id).toBe(
      "ines",
    );
    expect(searchProfiles(bootstrap.profiles, "march")[0].person.id).toBe(
      "theo",
    );
    expect(searchProfiles(bootstrap.profiles, "")).toEqual([]);
    expect(searchProfiles(bootstrap.profiles, "<script>")).toEqual([]);
    const stranger = bootstrap.profiles.find(
      (profile) => profile.person.id === "nadia",
    )!;
    expect(stranger.recent).toEqual([]);
    expect(stranger.photos).toEqual([]);
  });
  it("assigns the actor and friends audience internally and rejects injected fields and unsafe links", () => {
    const { state } = fixture();
    const original = structuredClone(state);
    const next = publishLocalPost(state, "ines", input, "post-local-test", now);
    expect(next.posts[0]).toMatchObject({
      author: { id: "ines" },
      audience: "friends",
      paragraphs: [input.body],
      expiresAt: "2026-11-27T20:00:00.000Z",
    });
    expect(state).toEqual(original);
    for (const value of [
      { ...input, authorId: "theo" },
      { ...input, audience: "public" },
      { ...input, body: " " },
      { ...input, kind: "link", url: "javascript:alert(1)" },
      { ...input, kind: "link", url: "https://user:secret@example.com" },
    ])
      expect(postInputSchema.safeParse(value).success).toBe(false);
    const link = publishLocalPost(
      { ...state, postingRecords: [] },
      "ines",
      { ...input, kind: "link", url: "https://example.com/article" },
      "post-local-link",
      now,
    );
    expect(link.posts[0].link).toEqual({
      title: "example.com",
      url: "https://example.com/article",
    });
  });
  it("enforces photo ownership and keeps a gallery-only removal from deleting the post or asset", () => {
    const { state } = fixture();
    const photo = state.photos[0];
    const posted = publishLocalPost(
      state,
      "ines",
      { ...input, photoIds: [photo.id] },
      "post-local-photo",
      now,
    );
    const removed = changeGallery(posted, "ines", photo.id, "remove");
    expect(removed.posts).toBe(posted.posts);
    expect(removed.posts[0].media?.[0].image).toEqual(photo.image);
    expect(removed.photos.some((item) => item.id === photo.id)).toBe(true);
    expect(removed.gallery.some((entry) => entry.photoId === photo.id)).toBe(
      false,
    );
    expect(() => placePhoto(state, "theo", photo.id)).toThrow("unavailable");
    expect(() =>
      publishLocalPost(
        state,
        "theo",
        { ...input, photoIds: [photo.id] },
        "post-local-forged",
        now,
      ),
    ).toThrow("unavailable");
  });
  it("replaces a full gallery atomically and preserves the replaced post image", () => {
    const { state } = fixture();
    const photos = Array.from({ length: 21 }, (_, index) => ({
      ...state.photos[0],
      id: `photo-${index}`,
    }));
    const full: LocalState = {
      ...state,
      photos,
      gallery: photos
        .slice(0, 20)
        .map((photo, index) => ({ photoId: photo.id, featured: index === 0 })),
    };
    expect(() =>
      publishLocalPost(
        full,
        "ines",
        { ...input, photoIds: ["photo-20"] },
        "post-local-full",
        now,
      ),
    ).toThrow("gallery is full");
    expect(full.posts).toEqual(state.posts);
    expect(full.gallery).toHaveLength(20);
    const next = publishLocalPost(
      full,
      "ines",
      {
        ...input,
        photoIds: ["photo-20"],
        replacements: { "photo-20": "photo-0" },
      },
      "post-local-replaced",
      now,
    );
    expect(next.gallery).toHaveLength(20);
    expect(next.gallery[0]).toEqual({ photoId: "photo-20", featured: true });
    expect(next.photos.some((photo) => photo.id === "photo-0")).toBe(true);
    expect(() => placePhoto(full, "ines", "photo-20", "missing")).toThrow(
      "Choose a photograph",
    );
  });
  it("bounds featuring and reorders without duplicating photos", () => {
    const { state } = fixture();
    const extra = { ...state.photos[0], id: "extra" };
    const full = {
      ...state,
      photos: [...state.photos, extra],
      gallery: [...state.gallery, { photoId: extra.id, featured: false }],
    };
    expect(() => changeGallery(full, "ines", extra.id, "feature")).toThrow(
      "up to three",
    );
    const moved = changeGallery(
      state,
      "ines",
      state.gallery[0].photoId,
      "later",
    );
    expect(moved.gallery.map((entry) => entry.photoId)).toEqual([
      state.gallery[1].photoId,
      state.gallery[0].photoId,
      ...state.gallery.slice(2).map((entry) => entry.photoId),
    ]);
    expect(state.gallery[0].featured).toBe(true);
  });
});
describe("gallery drag policy", () => {
  it("swaps featured slots across rows without increasing their count or losing assets", () => {
    const { state } = fixture();
    const extra = { ...state.photos[0], id: "extra" };
    const original = {
      ...state,
      photos: [...state.photos, extra],
      gallery: [...state.gallery, { photoId: extra.id, featured: false }],
    };
    const next = reorderGallery(
      original,
      "ines",
      extra.id,
      original.gallery[0].photoId,
    );
    expect(next.gallery[0]).toEqual({ photoId: extra.id, featured: true });
    expect(next.gallery.filter((entry) => entry.featured)).toHaveLength(3);
    expect(new Set(next.gallery.map((entry) => entry.photoId)).size).toBe(
      original.gallery.length,
    );
    expect(next.photos).toBe(original.photos);
    expect(original.gallery[0]).toEqual(state.gallery[0]);
    expect(() =>
      reorderGallery(original, "theo", extra.id, state.gallery[0].photoId),
    ).toThrow();
    expect(() =>
      reorderGallery(original, "ines", "missing", extra.id),
    ).toThrow();
  });
});
describe("browser-local media validation", () => {
  const png = () =>
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZmcAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "private-name.png",
      { type: "image/png" },
    );
  it("checks type, byte signature, size and description before image decoding", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    for (const file of [
      new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
      new File(["not png"], "image.png", { type: "image/png" }),
      new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.jpg", {
        type: "image/jpeg",
      }),
    ])
      await expect(validateLocalPhoto(file, "A photograph")).rejects.toThrow();
    await expect(validateLocalPhoto(png(), " ")).rejects.toThrow("Describe");
    expect(decode).not.toHaveBeenCalled();
  });
  it("bounds decoded dimensions, releases bitmap memory, and returns generic decoding errors", async () => {
    const close = vi.fn();
    const decode = vi
      .fn()
      .mockResolvedValue({ width: 640, height: 480, close });
    vi.stubGlobal("createImageBitmap", decode);
    await expect(validateLocalPhoto(png(), "A quiet beach")).resolves.toEqual({
      width: 640,
      height: 480,
    });
    expect(close).toHaveBeenCalledOnce();
    decode.mockResolvedValueOnce({ width: 10001, height: 500, close });
    await expect(validateLocalPhoto(png(), "A beach")).rejects.toThrow(
      "10,000",
    );
    decode.mockRejectedValueOnce(
      new Error("internal decoder private-name.png"),
    );
    await expect(validateLocalPhoto(png(), "A beach")).rejects.toThrow(
      "That image couldn’t be read.",
    );
  });
});

describe("music destination validation", () => {
  it("allows direct/search destinations and excludes redirects, embeds and other hosts", () => {
    const { state } = fixture();
    const track = {
      id: "itunes-123",
      title: "Anchor",
      artist: "Novo Amor",
      artwork: state.photos[0].image,
      appleMusicUrl: "https://music.apple.com/us/album/anchor/456?i=123&uo=4",
      spotifyUrl: "https://open.spotify.com/track/7qH9Z4dJEN0l9bidizW7fq",
    };
    expect(getListeningLinks(track)).toHaveLength(2);
    expect(
      getListeningLinks({
        ...track,
        spotifyUrl: "https://open.spotify.com/search/Anchor%20Novo%20Amor",
      }),
    ).toHaveLength(2);
    for (const url of [
      "javascript:alert(1)",
      "http://open.spotify.com/track/7qH9Z4dJEN0l9bidizW7fq",
      "https://open.spotify.com.evil.example/track/7qH9Z4dJEN0l9bidizW7fq",
      "https://open.spotify.com/embed/track/7qH9Z4dJEN0l9bidizW7fq",
      "https://open.spotify.com/track/7qH9Z4dJEN0l9bidizW7fq?redirect=https://evil.example",
      "https://music.apple.com/us/album/anchor/456?i=123&redirect=https://evil.example",
    ])
      expect(
        getListeningLinks({ ...track, appleMusicUrl: url, spotifyUrl: url }),
      ).toEqual([]);
  });
});
