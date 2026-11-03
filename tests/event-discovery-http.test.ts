// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { socialRequest } from "@/server/social/http";
import { requireViewer, UnauthorizedError } from "@/server/auth";
import { SpaceService } from "@/server/spaces/service";
import { enforceRateLimit } from "@/server/security/rate-limit";
vi.mock("@/server/auth", async (original) => ({
  ...(await original<typeof import("@/server/auth")>()),
  requireViewer: vi.fn(),
}));
vi.mock("@/server/db", () => ({ getDb: vi.fn() }));
vi.mock("@/server/security/rate-limit", async (original) => ({
  ...(await original<typeof import("@/server/security/rate-limit")>()),
  enforceRateLimit: vi.fn(),
}));
afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv("MARGIN_PRIVATE_BACKEND_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.mocked(requireViewer).mockResolvedValue({ id: "verified-subject" });
}
it("authenticates Event search, uses the read quota, and returns private metadata responses", async () => {
  setup();
  const search = vi
    .spyOn(SpaceService.prototype, "searchEvents")
    .mockResolvedValue({ events: [], nextCursor: null });
  const response = await socialRequest(
    new Request(
      "http://localhost:3000/api/spaces/events?q=Mumford&before=event-2",
    ),
    "spaceEvents",
  );
  expect(response.status).toBe(200);
  expect(search).toHaveBeenCalledWith("verified-subject", "Mumford", "event-2");
  expect(enforceRateLimit).toHaveBeenCalledWith("read", "verified-subject");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-robots-tag")).toContain("noindex");
  vi.mocked(requireViewer).mockRejectedValueOnce(new UnauthorizedError());
  expect(
    (
      await socialRequest(
        new Request("http://localhost:3000/api/spaces/events"),
        "spaceEvents",
      )
    ).status,
  ).toBe(401);
});
it("rejects repeated, unsupported and oversized Event search parameters", async () => {
  setup();
  const search = vi.spyOn(SpaceService.prototype, "searchEvents");
  for (const query of [
    "q=a&q=b",
    "viewerId=other",
    "before=a&before=b",
    `q=${"a".repeat(101)}`,
  ]) {
    expect(
      (
        await socialRequest(
          new Request(`http://localhost:3000/api/spaces/events?${query}`),
          "spaceEvents",
        )
      ).status,
    ).toBe(400);
  }
  expect(search).not.toHaveBeenCalled();
});
it("protects Event joining with origin validation, session identity and the Space write quota", async () => {
  setup();
  const join = vi
    .spyOn(SpaceService.prototype, "joinEvent")
    .mockResolvedValue({ id: "concert" });
  const denied = await socialRequest(
    new Request("http://localhost:3000/api/spaces/concert/join", {
      method: "POST",
      headers: { origin: "https://other.invalid" },
    }),
    "spaceJoin",
    "concert",
  );
  expect(denied.status).toBe(403);
  expect(join).not.toHaveBeenCalled();
  const response = await socialRequest(
    new Request("http://localhost:3000/api/spaces/concert/join", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-user-id": "forged" },
    }),
    "spaceJoin",
    "concert",
  );
  expect(response.status).toBe(200);
  expect(join).toHaveBeenCalledWith("verified-subject", "concert");
  expect(enforceRateLimit).toHaveBeenCalledWith(
    "spaceWrite",
    "verified-subject",
  );
});
it("opens a provider event by ID without a submitted duration", async () => {
  setup();
  const open = vi
    .spyOn(SpaceService.prototype, "joinTicketmasterEvent")
    .mockResolvedValue({ id: "canonical" });
  const request = (body: object) =>
    new Request("http://localhost:3000/api/spaces/events/provider-id/join", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const response = await socialRequest(
    request({}),
    "spaceEventOpen",
    "provider-id",
  );
  expect(response.status).toBe(200);
  expect(open).toHaveBeenCalledWith("verified-subject", "provider-id");
  expect(
    (
      await socialRequest(
        request({ endsAt: "not-a-date" }),
        "spaceEventOpen",
        "provider-id",
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await socialRequest(
        request({ name: "Forged provider metadata" }),
        "spaceEventOpen",
        "provider-id",
      )
    ).status,
  ).toBe(400);
});

it("validates admin schedule updates at the authenticated mutation boundary", async () => {
  setup();
  const schedule = vi
    .spyOn(SpaceService.prototype, "updateEventSchedule")
    .mockResolvedValue(undefined);
  const req = (body: object) =>
    new Request("http://localhost:3000/api/spaces/concert/schedule", {
      method: "PATCH",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  expect(
    (
      await socialRequest(
        req({ endsAt: "2026-11-08T12:00:00Z" }),
        "spaceSchedule",
        "concert",
      )
    ).status,
  ).toBe(204);
  expect(schedule).toHaveBeenCalledWith(
    "verified-subject",
    "concert",
    "2026-11-08T12:00:00Z",
  );
  expect(
    (
      await socialRequest(
        req({ endsAt: "invalid" }),
        "spaceSchedule",
        "concert",
      )
    ).status,
  ).toBe(400);
});
