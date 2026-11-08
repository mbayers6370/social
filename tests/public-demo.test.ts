import { afterEach, expect, it, vi } from "vitest";
import { assertDemoRequest } from "@/features/public-demo/network-boundary";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("permits exported assets and navigation but rejects service requests before transmission", () => {
  const origin = "https://margin.social";
  expect(() =>
    assertDemoRequest("/demo/?_rsc=sample", "GET", origin),
  ).not.toThrow();
  expect(() => assertDemoRequest("/demo/", "HEAD", origin)).not.toThrow();
  for (const href of [
    "/demo/index.txt",
    "/__next._tree.txt",
    "/your-data/__next.$d$document.__PAGE__.txt",
  ])
    expect(() => assertDemoRequest(href, "GET", origin)).not.toThrow();
  expect(() =>
    assertDemoRequest("/_next/static/media/art.jpg", "GET", origin),
  ).not.toThrow();
  expect(() =>
    assertDemoRequest("blob:https://margin.social/sample", "GET", origin),
  ).not.toThrow();
  for (const href of [
    "/api/__next._tree.txt",
    "/unexpected/__next._tree.txt",
    "/fonts/.env",
    "/_next/static/%2e%2e%2fapi/private",
    "/unexpected-backend",
    "/admin/export",
    "/privacy",
    "/api/posts",
    "/api/member/context",
    "/app/",
    "/__member_fixture/api/posts",
    "https://itunes.apple.com/search?q=music",
    "https://api.example.com/",
    "blob:https://other.example/sample",
  ]) {
    expect(() => assertDemoRequest(href, "GET", origin)).toThrow(
      /Demo blocked/,
    );
  }
  expect(() => assertDemoRequest("/demo/", "POST", origin)).toThrow(
    /No data was sent/,
  );
});

it("retains existing destinations in the full-stack target", async () => {
  vi.stubEnv("NEXT_PUBLIC_MARGIN_DEMO", "");
  const { previewHref } = await import("@/lib/public-demo");
  for (const href of [
    "/",
    "/app",
    "/app/feed",
    "/?view=messages",
    "/preview/spaces?space=japan-2027",
  ])
    expect(previewHref(href)).toBe(href);
});

it("maps shared preview and member links into the explicit demo route", async () => {
  vi.stubEnv("NEXT_PUBLIC_MARGIN_DEMO", "1");
  const { previewHref } = await import("@/lib/public-demo");
  expect(previewHref("/")).toBe("/demo/");
  expect(previewHref("/?view=profile&person=theo#post-book")).toBe(
    "/demo/?view=profile&person=theo#post-book",
  );
  expect(previewHref("/app")).toBe("/demo/?view=profile");
  expect(previewHref("/app/spaces/japan-2027")).toBe(
    "/demo/?view=spaces&space=japan-2027",
  );
  expect(previewHref("/app/messages")).toBe("/demo/?view=messages");
  expect(previewHref("/people/renamed_member")).toBe(
    "/demo/?view=profile&person=renamed_member",
  );
  expect(previewHref("/privacy")).toBe("/privacy");
});

it("permits only same-origin Next hot reload in development and no sockets in exports", async () => {
  const { isDemoHotReloadSocket } =
    await import("@/features/public-demo/network-boundary");
  vi.stubEnv("NODE_ENV", "development");
  expect(
    isDemoHotReloadSocket(
      "ws://localhost:3000/_next/hmr",
      "http://localhost:3000",
    ),
  ).toBe(true);
  for (const url of [
    "ws://localhost:3001/_next/hmr",
    "wss://external.example/_next/hmr",
    "ws://localhost:3000/api/messages",
  ])
    expect(isDemoHotReloadSocket(url, "http://localhost:3000")).toBe(false);
  vi.stubEnv("NODE_ENV", "production");
  expect(
    isDemoHotReloadSocket(
      "ws://localhost:3000/_next/hmr",
      "http://localhost:3000",
    ),
  ).toBe(false);
});
