// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/development/events/route";
import { ticketmasterCatalog } from "@/server/spaces/ticketmaster";
import { calvinEvent } from "./helpers/ticketmaster-fixture";
vi.mock("@/server/spaces/ticketmaster", () => ({
  ticketmasterCatalog: { search: vi.fn(), event: vi.fn() },
}));
afterEach(() => vi.unstubAllEnvs());
it("keeps public provider metadata behind the development same-origin gate", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(
    (
      await GET(
        new NextRequest(
          "http://localhost:3000/api/development/events?q=Calvin",
        ),
      )
    ).status,
  ).toBe(404);
  vi.stubEnv("NODE_ENV", "development");
  expect(
    (
      await GET(
        new NextRequest(
          "http://localhost:3000/api/development/events?q=Calvin",
        ),
      )
    ).status,
  ).toBe(403);
  const cross = new NextRequest(
    "http://localhost:3000/api/development/events?q=Calvin",
    { headers: { "x-margin-preview": "1", origin: "https://other.invalid" } },
  );
  expect((await GET(cross)).status).toBe(403);
  expect(ticketmasterCatalog.search).not.toHaveBeenCalled();
});
it("returns provider metadata without exposing credentials and rejects invalid paging/queries", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.mocked(ticketmasterCatalog.search).mockResolvedValue({
    events: [calvinEvent],
    nextPage: null,
  });
  const req = (q: string) =>
    new NextRequest(`http://localhost:3000/api/development/events?${q}`, {
      headers: { "x-margin-preview": "1" },
    });
  const response = await GET(req("q=Calvin&page=0"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    events: [calvinEvent],
    nextPage: null,
  });
  for (const query of [
    "page=-1",
    "page=50",
    "q=a&q=b",
    "apikey=forged",
    "city=Las+Vegas",
  ])
    expect((await GET(req(query))).status).toBe(400);
});
