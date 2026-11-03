import type { Page } from "@playwright/test";
import { calvinEvent } from "../../helpers/ticketmaster-fixture";
import type { CatalogEvent } from "@/features/spaces/contracts";

export function eventFixtures(count = 1): CatalogEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    ...calvinEvent,
    id: index ? `${calvinEvent.id}-${index}` : calvinEvent.id,
    startsAt: new Date(
      Date.parse(calvinEvent.startsAt) + index * 86_400_000,
    ).toISOString(),
    // These flows exercise search/join/scrolling without an external image request.
    imageUrl: null,
  }));
}

/** Mock the app's catalog boundary, including exact-ID loading when joining. */
export async function mockTicketmasterCatalog(
  page: Page,
  events = eventFixtures(),
) {
  await page.route("**/api/development/events?*", async (route) => {
    const query = new URL(route.request().url()).searchParams;
    if (query.has("id")) {
      const event = events.find((item) => item.id === query.get("id"));
      await route.fulfill(
        event
          ? { json: { event } }
          : { status: 404, json: { error: "Unknown fixture event" } },
      );
      return;
    }
    const search = (query.get("q") ?? "").trim().toLowerCase();
    await route.fulfill({
      json: {
        events:
          Number(query.get("page") ?? 0) === 0
            ? events.filter((event) =>
                event.name.toLowerCase().includes(search),
              )
            : [],
        nextPage: null,
      },
    });
  });
}
