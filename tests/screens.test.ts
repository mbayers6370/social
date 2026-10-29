// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevelopmentScreens } from "@/server/fixtures/screens";
import { getDevelopmentSocial } from "@/server/fixtures/social";
import { messageInputSchema } from "@/features/messages/schema";
import { continuesMessageGroup } from "@/features/messages/format";
import type { PreviewMessage } from "@/features/messages/schema";
import { profileInputSchema } from "@/features/profile/schema";
import { postSchema } from "@/features/feed/schema";
import { getDevelopmentFeed } from "@/server/fixtures/feed";

afterEach(() => vi.unstubAllEnvs());

describe("message reading groups", () => {
  const message = (
    createdAt: string,
    direction: PreviewMessage["direction"] = "incoming",
  ): PreviewMessage => ({
    id: createdAt,
    body: "A thought",
    createdAt,
    direction,
  });

  it("groups nearby messages from one speaker, but breaks for a speaker change or longer pause", () => {
    const first = message("2026-10-27T16:00:00Z");
    expect(continuesMessageGroup(undefined, first)).toBe(false);
    expect(continuesMessageGroup(first, message("2026-10-27T16:00:00Z"))).toBe(
      true,
    );
    expect(continuesMessageGroup(first, message("2026-10-27T16:05:00Z"))).toBe(
      true,
    );
    expect(continuesMessageGroup(first, message("2026-10-27T16:05:01Z"))).toBe(
      false,
    );
    expect(
      continuesMessageGroup(first, message("2026-10-27T16:01:00Z", "outgoing")),
    ).toBe(false);
    expect(continuesMessageGroup(first, message("2026-10-27T15:59:00Z"))).toBe(
      false,
    );
  });

  it("starts a new group across local midnight, even within the five-minute window", () => {
    expect(
      continuesMessageGroup(
        message("2026-10-27T06:59:59Z"),
        message("2026-10-27T07:00:01Z"),
      ),
    ).toBe(false);
    // UTC midnight is still the same local afternoon in Los Angeles.
    expect(
      continuesMessageGroup(
        message("2026-10-26T23:59:59Z"),
        message("2026-10-27T00:00:01Z"),
      ),
    ).toBe(true);
  });
});

describe("screen preview boundaries", () => {
  it("fills the two friend profiles with their own photos, posts and sample music", () => {
    vi.stubEnv("NODE_ENV", "development");
    const data = getDevelopmentSocial();
    const june = data.profiles.find((profile) => profile.person.id === "june")!;
    const samuel = data.profiles.find(
      (profile) => profile.person.id === "samuel",
    )!;
    expect(data.viewerId).toBe("ines");
    expect(june.person.photo?.src).toContain("park-2");
    expect(samuel.person.photo?.src).toContain("Okafor-profile");
    expect(june.photos).toHaveLength(3);
    expect(samuel.photos).toHaveLength(2);
    expect(
      june.photos.some((photo) => photo.image.src.includes("park-1")),
    ).toBe(true);
    expect(
      samuel.photos.some((photo) => photo.image.src.includes("Okafor-post")),
    ).toBe(true);
    for (const profile of [june, samuel]) {
      expect(profile.recent.length).toBeGreaterThanOrEqual(3);
      expect(profile.onRepeat).toHaveLength(1);
      expect(new Set(profile.photos.map((photo) => photo.image.src)).size).toBe(
        profile.photos.length,
      );
      for (const recent of profile.recent) {
        expect(recent.createdAt).toBeDefined();
        expect(
          data.posts?.find((post) => post.id === recent.id)?.author.id,
        ).toBe(profile.person.id);
      }
    }
    expect(data.photos.every((photo) => photo.ownerId === data.viewerId)).toBe(
      true,
    );
  });
  it("does not expose profile or message fixtures outside development", () => {
    for (const value of ["production", "test"] as const) {
      vi.stubEnv("NODE_ENV", value);
      expect(getDevelopmentScreens).toThrow(
        "Development fixtures are unavailable",
      );
    }
  });
  it("validates sample conversations and keeps them oldest first", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { threads, profile } = getDevelopmentScreens();
    expect(threads).toHaveLength(3);
    for (const thread of threads)
      expect(thread.messages.map((message) => message.createdAt)).toEqual(
        thread.messages.map((message) => message.createdAt).sort(),
      );
    expect(profile.photos).toHaveLength(3);
    expect(profile.person.name).toBe("Ines Alvarez");
  });
  it("bounds local message input and rejects unexpected recipient fields", () => {
    expect(messageInputSchema.parse({ body: " A thought " })).toEqual({
      body: "A thought",
    });
    for (const input of [
      { body: " " },
      { body: "x".repeat(2001) },
      { body: "Hello", recipient: "other" },
    ])
      expect(messageInputSchema.safeParse(input).success).toBe(false);
  });
  it("bounds profile changes and rejects unexpected account fields", () => {
    expect(profileInputSchema.parse({ name: " Ines ", bio: " Hi " })).toEqual({
      name: "Ines",
      bio: "Hi",
    });
    for (const input of [
      { name: "", bio: "" },
      { name: "Ines", bio: "x".repeat(301) },
      { name: "Ines", bio: "", role: "admin" },
    ])
      expect(profileInputSchema.safeParse(input).success).toBe(false);
  });
  it("accepts only generated local image paths in the fixture DTO", () => {
    vi.stubEnv("NODE_ENV", "development");
    const post = getDevelopmentFeed().posts[0];
    for (const src of [
      "https://untrusted.example/image.jpg",
      "/api/private",
      "/_next/static/media/../../secret",
    ])
      expect(
        postSchema.safeParse({
          ...post,
          media: [
            { ...post.media![0], image: { ...post.media![0].image, src } },
          ],
        }).success,
      ).toBe(false);
  });
});
