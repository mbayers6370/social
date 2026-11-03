// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import {
  parseTicketmasterEvent,
  ticketmasterCatalog,
} from "@/server/spaces/ticketmaster";
import {
  calvinEvent,
  calvinProviderEvent,
} from "./helpers/ticketmaster-fixture";
vi.mock("@/server/security/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("maps the verified Calvin Harris listing and image without inventing its missing end time", () => {
  expect(parseTicketmasterEvent(calvinProviderEvent)).toEqual(calvinEvent);
  expect(
    parseTicketmasterEvent({
      ...calvinProviderEvent,
      dates: { ...calvinProviderEvent.dates, status: { code: "cancelled" } },
    }),
  ).toBeNull();
  expect(
    parseTicketmasterEvent({
      ...calvinProviderEvent,
      images: [{ url: "https://untrusted.invalid/image.jpg", width: 1024 }],
      url: "https://untrusted.invalid",
    }),
  ).toMatchObject({ imageUrl: null, sourceUrl: null });
});
it("uses the provider end instant or an unambiguous local end with the venue timezone", () => {
  expect(
    parseTicketmasterEvent({
      ...calvinProviderEvent,
      dates: {
        ...calvinProviderEvent.dates,
        end: { localDate: "2026-11-08", localTime: "04:00:00" },
      },
    })?.endsAt,
  ).toBe("2026-11-08T12:00:00.000Z");
  expect(
    parseTicketmasterEvent({
      ...calvinProviderEvent,
      dates: {
        ...calvinProviderEvent.dates,
        end: { dateTime: "2026-11-08T12:00:00Z" },
      },
    })?.endsAt,
  ).toBe("2026-11-08T12:00:00.000Z");
});
it("searches the complete Discovery catalog with bounded pagination and a server-only key", async () => {
  vi.stubEnv("TICKETMASTER_API_KEY", "test-key-never-real");
  const fetcher = vi.fn().mockResolvedValue(
    Response.json({
      _embedded: { events: [calvinProviderEvent] },
      page: { totalPages: 2 },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  const found = await ticketmasterCatalog.search("Calvin Harris", 0);
  expect(found).toEqual({ events: [calvinEvent], nextPage: 1 });
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(url.origin).toBe("https://app.ticketmaster.com");
  expect(url.searchParams.has("city")).toBe(false);
  expect(url.searchParams.has("source")).toBe(false);
  expect(url.searchParams.get("size")).toBe("20");
  expect(url.searchParams.get("apikey")).toBe("test-key-never-real");
  expect(JSON.stringify(found)).not.toContain("test-key-never-real");
});
it("sanitizes provider failures and does not guess data when the key is absent", async () => {
  vi.stubEnv("TICKETMASTER_API_KEY", "");
  await expect(ticketmasterCatalog.event("no-key")).rejects.toMatchObject({
    status: 503,
  });
  vi.stubEnv("TICKETMASTER_API_KEY", "test-key-never-real");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        Error("https://provider.invalid?apikey=test-key-never-real"),
      ),
  );
  await expect(ticketmasterCatalog.event("failed-event")).rejects.toMatchObject(
    {
      status: 503,
      message: expect.not.stringContaining("test-key-never-real"),
    },
  );
});
