// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { search, change, read } = vi.hoisted(() => ({
  search: vi.fn(),
  change: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/server/music/catalogue", async (original) => ({
  ...(await original<typeof import("@/server/music/catalogue")>()),
  catalogue: { search, lookup: vi.fn() },
}));
vi.mock("@/server/music/selections", () => ({
  changeMusic: change,
  readMusic: read,
}));
import { GET as searchMusic } from "@/app/api/development/music/route";
import {
  GET as selections,
  POST as update,
} from "@/app/api/development/music/selections/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function request(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      "X-Margin-Preview": "1",
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
it("keeps both music endpoints unavailable outside development", async () => {
  for (const mode of ["test", "production"]) {
    vi.stubEnv("NODE_ENV", mode);
    expect(
      (await searchMusic(request("/api/development/music?q=Anchor"))).status,
    ).toBe(404);
    expect(
      (
        await update(
          request("/api/development/music/selections", {
            action: "add",
            trackId: "itunes-123",
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await selections(request("/api/development/music/selections"))).status,
    ).toBe(404);
  }
  expect(search).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
it("rejects foreign origins, remote hosts, missing request markers and extra query fields", async () => {
  vi.stubEnv("NODE_ENV", "development");
  for (const req of [
    request("/api/development/music?q=Anchor", undefined, {
      Origin: "https://evil.example",
    }),
    request("/api/development/music?q=Anchor", undefined, {
      "X-Margin-Preview": "",
    }),
    new NextRequest("https://remote.example/api/development/music?q=Anchor", {
      headers: { "X-Margin-Preview": "1" },
    }),
  ])
    expect((await searchMusic(req)).status).toBe(403);
  for (const query of [
    "q=x",
    "q=Anchor&owner=other",
    "q=one&q=two",
    `q=${"x".repeat(81)}`,
  ])
    expect(
      (await searchMusic(request(`/api/development/music?${query}`))).status,
    ).toBe(400);
  expect(search).not.toHaveBeenCalled();
});
it("returns validated search results and saves only an action/reference without a submitted owner", async () => {
  vi.stubEnv("NODE_ENV", "development");
  search.mockResolvedValue([]);
  change.mockResolvedValue([]);
  read.mockResolvedValue([]);
  const result = await searchMusic(request("/api/development/music?q=Anchor"));
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ tracks: [] });
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(
    (
      await update(
        request("/api/development/music/selections", {
          action: "add",
          trackId: "itunes-123",
          owner: "other",
        }),
      )
    ).status,
  ).toBe(400);
  expect(change).not.toHaveBeenCalled();
  expect(
    (
      await update(
        request("/api/development/music/selections", {
          action: "add",
          trackId: "itunes-123",
        }),
      )
    ).status,
  ).toBe(200);
  expect(change).toHaveBeenCalledWith({ action: "add", trackId: "itunes-123" });
  expect(
    (await selections(request("/api/development/music/selections?owner=other")))
      .status,
  ).toBe(400);
  expect(
    (
      await update(
        request("/api/development/music/selections", {
          value: "x".repeat(600),
        }),
      )
    ).status,
  ).toBe(413);
  change.mockRejectedValue(
    new Error("password=secret DATABASE_URL private sql"),
  );
  const failed = await update(
    request("/api/development/music/selections", {
      action: "remove",
      trackId: "itunes-123",
    }),
  );
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toMatch(
    /secret|DATABASE_URL|private sql/,
  );
});

it("supports the explicitly approved device host without allowing unrelated origins", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("MARGIN_DEV_ALLOWED_HOSTS", "device.example.test");
  search.mockResolvedValue([]);
  const allowed = new NextRequest(
    "http://localhost:3000/api/development/music?q=Anchor",
    {
      headers: {
        Host: "device.example.test:3000",
        Origin: "http://device.example.test:3000",
        "X-Margin-Preview": "1",
        "Sec-Fetch-Site": "same-origin",
      },
    },
  );
  expect((await searchMusic(allowed)).status).toBe(200);
  const denied = new NextRequest(
    "http://localhost:3000/api/development/music?q=Anchor",
    {
      headers: {
        Host: "device.example.test:3000",
        Origin: "http://other.example.test:3000",
        "X-Margin-Preview": "1",
      },
    },
  );
  expect((await searchMusic(denied)).status).toBe(403);
});
