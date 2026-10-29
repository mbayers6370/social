// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCatalogue, parseCatalogue } from "@/server/music/catalogue";
import { profileTrackSchema } from "@/features/profile/music-schema";

const item = {
  wrapperType: "track",
  kind: "song",
  trackId: 123,
  trackName: "Anchor",
  artistName: "Novo Amor",
  trackViewUrl: "https://music.apple.com/us/album/anchor/456?i=123&uo=4",
  artworkUrl100:
    "https://is1-ssl.mzstatic.com/image/thumb/Music123/cover.jpg/100x100bb.jpg",
  previewUrl: "https://private.example/audio.m4a",
};
const response = () => Response.json({ results: [item] });
describe("Apple song catalogue boundary", () => {
  it("retains only bounded song metadata, deduplicates references and drops all playback/video fields", () => {
    const songs = parseCatalogue({
      results: [
        item,
        item,
        { ...item, trackId: 124, kind: "music-video" },
        { ...item, trackViewUrl: "javascript:alert(1)" },
      ],
    });
    expect(songs).toHaveLength(1);
    expect(songs[0]).toMatchObject({
      id: "itunes-123",
      title: "Anchor",
      source: "itunes",
      spotifyUrl: "https://open.spotify.com/search/Anchor%20Novo%20Amor",
    });
    expect(JSON.stringify(songs)).not.toMatch(
      /previewUrl|m4a|music-video|private\.example/,
    );
    expect(
      parseCatalogue({
        results: [{ ...item, artworkUrl100: "https://evil.example/video.mp4" }],
      })[0].artwork,
    ).toBeUndefined();
    expect(
      profileTrackSchema.safeParse({
        ...songs[0],
        artwork: {
          src: "https://is1-ssl.mzstatic.com.evil.example/image/thumb/a.jpg",
          width: 100,
          height: 100,
        },
      }).success,
    ).toBe(false);
  });
  it("coalesces concurrent searches, reuses cached songs for lookup and expires cache entries", async () => {
    let now = 1000;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const api = createCatalogue(fetcher, () => now);
    await Promise.all([api.search("Anchor"), api.search("ANCHOR")]);
    expect(fetcher).toHaveBeenCalledOnce();
    await api.lookup("itunes-123");
    expect(fetcher).toHaveBeenCalledOnce();
    now += 600_001;
    await api.search("Anchor");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.origin).toBe("https://itunes.apple.com");
    expect(url.searchParams.get("entity")).toBe("song");
    expect(url.searchParams.get("media")).toBe("music");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      redirect: "error",
      cache: "no-store",
    });
  });
  it("rejects invalid queries and enforces the local shared upstream budget without retry storms", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const api = createCatalogue(fetcher, () => 1000);
    expect(() => api.search("x")).toThrow();
    expect(() => api.search("x".repeat(81))).toThrow();
    for (let i = 0; i < 15; i++) await api.search(`song ${i}`);
    await expect(api.search("another song")).rejects.toMatchObject({
      status: 429,
    });
    expect(fetcher).toHaveBeenCalledTimes(15);
  });
  it("returns safe failures on malformed, oversized, unavailable or missing provider responses", async () => {
    for (const fetcher of [
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("secret upstream details")),
      vi.fn<typeof fetch>().mockResolvedValue(new Response("not json")),
      vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(512001))),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private", { status: 500 })),
    ]) {
      await expect(createCatalogue(fetcher).search("Anchor")).rejects.toThrow(
        "Music search is temporarily unavailable.",
      );
    }
    const api = createCatalogue(
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ results: [] })),
    );
    await expect(api.lookup("itunes-123")).rejects.toMatchObject({
      status: 404,
    });
    await expect(api.lookup("forged-url")).rejects.toMatchObject({
      status: 400,
    });
  });
});
