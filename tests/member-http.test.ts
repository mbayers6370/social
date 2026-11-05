// @vitest-environment node
// HTTP guards use doubles; member-db.integration tests exercise the real DAL.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { memberRequest } from "@/server/member/http";
import { postDraftRequest } from "@/server/social/http";
import { requireViewer, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
const methods = vi.hoisted(() => ({
  topFriends: vi.fn(),
  updateTopFriends: vi.fn(),
  identity: vi.fn(),
  preferences: vi.fn(),
  publish: vi.fn(),
  account: vi.fn(),
  conversation: vi.fn(),
  exportAccount: vi.fn(),
  uploadGallery: vi.fn(),
  reports: vi.fn(),
  review: vi.fn(),
  eventAdmin: vi.fn(),
}));
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("@/server/auth")>()),
  requireViewer: vi.fn(),
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/safety/service", () => ({
  ModerationService: class {
    reports = methods.reports;
    review = methods.review;
    assignEventAdmin = methods.eventAdmin;
  },
}));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(),
}));
vi.mock("@/server/member/service", () => ({
  MemberService: class {
    topFriends = methods.topFriends;
    updateTopFriends = methods.updateTopFriends;
    identity = methods.identity;
    updatePreferences = methods.preferences;
    publishPersonal = methods.publish;
    account = methods.account;
    conversation = methods.conversation;
    exportAccount = methods.exportAccount;
    uploadGallery = methods.uploadGallery;
  },
}));
beforeEach(() => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.mocked(requireViewer).mockResolvedValue({ id: "verified-subject" });
  methods.account.mockResolvedValue({ accountStatus: "ACTIVE" });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const request = (path = "/api/member/context", body?: unknown) =>
  new Request(
    `http://localhost:3000${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            Origin: "http://localhost:3000",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
  );
it("keeps operator routes behind verified identity, private reads, origin checks and the mutation limiter", async () => {
  vi.mocked(requireViewer).mockRejectedValueOnce(new UnauthorizedError());
  expect(
    (
      await memberRequest(
        request("/api/moderation/reports"),
        "moderationReports",
      )
    ).status,
  ).toBe(401);
  expect(methods.reports).not.toHaveBeenCalled();
  methods.reports.mockResolvedValue({ reports: [], nextCursor: null });
  const read = await memberRequest(
    request("/api/moderation/reports"),
    "moderationReports",
  );
  expect(read.status).toBe(200);
  expect(read.headers.get("Cache-Control")).toContain("no-store");
  expect(methods.reports).toHaveBeenCalledWith("verified-subject", undefined);
  expect(
    (
      await memberRequest(
        request("/api/moderation/reports?role=FOUNDER"),
        "moderationReports",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await memberRequest(
        new Request("http://localhost:3000/api/moderation/reports/report", {
          method: "PATCH",
          headers: { Origin: "https://attacker.invalid" },
        }),
        "moderationReview",
        "report",
      )
    ).status,
  ).toBe(403);
  expect(methods.review).not.toHaveBeenCalled();
  methods.review.mockResolvedValue({ id: "report", status: "DISMISSED" });
  const body = { action: "DISMISS", note: "Reviewed" };
  expect(
    (
      await memberRequest(
        request("/api/moderation/reports/report", body),
        "moderationReview",
        "report",
      )
    ).status,
  ).toBe(200);
  expect(methods.review).toHaveBeenCalledWith(
    "verified-subject",
    "report",
    body,
  );
  expect(enforceRateLimit).toHaveBeenLastCalledWith(
    "mutation",
    "verified-subject",
  );
});
it("keeps disabled and anonymous member access closed despite forged identity headers", async () => {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "");
  expect((await memberRequest(request(), "identity")).status).toBe(503);
  expect(requireViewer).not.toHaveBeenCalled();
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.mocked(requireViewer).mockRejectedValueOnce(new UnauthorizedError());
  const response = await memberRequest(
    new Request("http://localhost:3000/api/member/context", {
      headers: { "x-user-id": "founder", "x-margin-preview": "1" },
    }),
    "identity",
  );
  expect(response.status).toBe(401);
  expect(getDb).not.toHaveBeenCalled();
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});
it("uses only the verified subject and returns private responses", async () => {
  methods.identity.mockResolvedValue({ username: "saved_member" });
  const response = await memberRequest(request(), "identity");
  expect(methods.identity).toHaveBeenCalledWith("verified-subject");
  expect(await response.json()).toEqual({ username: "saved_member" });
  expect(response.headers.get("Cache-Control")).toContain("private");
});
it("rejects actor query parameters, repeated cursors and cross-site mutations before database access", async () => {
  for (const path of [
    "/api/messages?ownerId=other",
    "/api/messages?before=a&before=b",
    "/api/messages?before=../other",
  ])
    expect((await memberRequest(request(path), "threads")).status).toBe(400);
  const response = await memberRequest(
    new Request("http://localhost:3000/api/member/preferences", {
      method: "PATCH",
      headers: {
        Origin: "https://other.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    "preferences",
  );
  expect(response.status).toBe(403);
  expect(getDb).not.toHaveBeenCalled();
});
it("fails closed on Redis or authentication outages and sanitizes failures", async () => {
  vi.mocked(enforceRateLimit).mockRejectedValueOnce(
    new Error("PRIVATE_REDIS_CANARY"),
  );
  const response = await memberRequest(request(), "identity");
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("CANARY");
  expect(getDb).not.toHaveBeenCalled();
});
it("returns Retry-After for rate limits and limits expensive exports separately", async () => {
  vi.mocked(enforceRateLimit).mockRejectedValueOnce(new RateLimitError(12));
  const response = await memberRequest(request("/api/member/export"), "export");
  expect(enforceRateLimit).toHaveBeenCalledWith(
    "accountExport",
    "verified-subject",
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("12");
  expect(methods.exportAccount).not.toHaveBeenCalled();
});
it("bounds multipart publishing, rejects unexpected identity fields, and passes normalized transport data", async () => {
  const form = new FormData();
  form.set("input", JSON.stringify({ body: "A photograph", photoIds: [] }));
  form.append(
    "photos",
    new File([new Uint8Array([255, 216, 255])], "sample.jpg", {
      type: "image/jpeg",
    }),
  );
  methods.publish.mockResolvedValue({ id: "saved-post" });
  const response = await memberRequest(
    new Request("http://localhost:3000/api/posts/publish", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
      body: form,
    }),
    "postPublish",
  );
  expect(response.status).toBe(201);
  expect(methods.publish).toHaveBeenCalledWith(
    "verified-subject",
    { body: "A photograph", photoIds: [] },
    [
      {
        bytes: new Uint8Array([255, 216, 255]),
        type: "image/jpeg",
        description: "Photograph",
      },
    ],
  );
  await expect(
    postDraftRequest(
      request("/api/posts/publish", {
        body: "Forged",
        photoIds: [],
        ownerId: "someone-else",
      }),
    ),
  ).rejects.toThrow();
  for (const name of ["b.jpg", "c.jpg", "d.jpg"])
    form.append("photos", new File(["x"], name));
  await expect(
    postDraftRequest(
      new Request("http://localhost:3000/api/posts/publish", {
        method: "POST",
        body: form,
      }),
    ),
  ).rejects.toThrow("three photographs");
});
it("accepts a Gallery upload without description headers", async () => {
  methods.uploadGallery.mockResolvedValue({ id: "photo" });
  const response = await memberRequest(
    new Request("http://localhost:3000/api/gallery/photo", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array([255, 216, 255]),
    }),
    "galleryUpload",
  );
  expect(response.status).toBe(201);
  expect(methods.uploadGallery).toHaveBeenCalledWith(
    "verified-subject",
    new Uint8Array([255, 216, 255]),
    "image/jpeg",
    "Photograph",
    undefined,
  );
});

it("rejects a pending account before reading uploaded bytes", async () => {
  methods.account.mockResolvedValueOnce({ accountStatus: "PENDING" });
  const response = await memberRequest(
    request("/api/posts/publish", { body: "Cannot publish" }),
    "postPublish",
  );
  expect(response.status).toBe(403);
  expect(methods.publish).not.toHaveBeenCalled();
});

it("protects Top 4 reads and writes with verified identity, origin, private caching and named rate limits", async () => {
  vi.mocked(requireViewer).mockRejectedValueOnce(new UnauthorizedError());
  expect(
    (await memberRequest(request("/api/profiles/me/top-friends"), "topFriends"))
      .status,
  ).toBe(401);
  expect(methods.topFriends).not.toHaveBeenCalled();
  methods.topFriends.mockResolvedValue({
    selected: [],
    contacts: [],
    nextCursor: null,
  });
  const read = await memberRequest(
    request("/api/profiles/me/top-friends?q=Alex"),
    "topFriends",
  );
  expect(read.status).toBe(200);
  expect(read.headers.get("cache-control")).toContain("no-store");
  expect(methods.topFriends).toHaveBeenCalledWith(
    "verified-subject",
    "Alex",
    undefined,
  );
  expect(
    (
      await memberRequest(
        new Request("http://localhost:3000/api/profiles/me/top-friends", {
          method: "PUT",
          headers: { Origin: "https://elsewhere.example" },
          body: "{}",
        }),
        "topFriendsUpdate",
      )
    ).status,
  ).toBe(403);
  expect(methods.updateTopFriends).not.toHaveBeenCalled();
  const payload = {
    friendIds: [],
    requestId: "a1e1370e-5c5e-4d24-9a22-3152c80ff2c8",
  };
  methods.updateTopFriends.mockResolvedValue({ selected: [] });
  expect(
    (
      await memberRequest(
        request("/api/profiles/me/top-friends", payload),
        "topFriendsUpdate",
      )
    ).status,
  ).toBe(200);
  expect(methods.updateTopFriends).toHaveBeenCalledWith(
    "verified-subject",
    payload,
  );
  expect(enforceRateLimit).toHaveBeenLastCalledWith(
    "mutation",
    "verified-subject",
  );
  expect(
    (
      await memberRequest(
        request("/api/profiles/me/top-friends?ownerId=someone"),
        "topFriends",
      )
    ).status,
  ).toBe(400);
});
