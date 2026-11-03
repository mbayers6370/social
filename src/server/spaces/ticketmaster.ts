import "server-only";
import { z } from "zod";
import type { CatalogEvent } from "@/features/spaces/contracts";
import { eventTimeCandidates } from "@/features/spaces/event-time";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { SocialError } from "@/server/social/errors";

const instant = z.iso.datetime({ offset: true });
const providerEvent = z.object({
  id: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1),
  url: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string(),
        width: z.number(),
        ratio: z.string().optional(),
      }),
    )
    .optional(),
  dates: z.object({
    timezone: z.string().optional(),
    start: z.object({
      dateTime: instant.optional(),
      dateTBD: z.boolean().optional(),
      dateTBA: z.boolean().optional(),
      timeTBA: z.boolean().optional(),
      noSpecificTime: z.boolean().optional(),
    }),
    end: z
      .object({
        dateTime: instant.optional(),
        localDate: z.string().optional(),
        localTime: z.string().optional(),
      })
      .optional(),
    status: z.object({ code: z.string() }).optional(),
  }),
  _embedded: z
    .object({
      venues: z
        .array(
          z.object({
            name: z.string().optional(),
            timezone: z.string().optional(),
            city: z.object({ name: z.string() }).optional(),
            state: z.object({ stateCode: z.string().optional() }).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});
export function parseTicketmasterEvent(raw: unknown): CatalogEvent | null {
  const parsed = providerEvent.safeParse(raw);
  if (!parsed.success) return null;
  const event = parsed.data;
  if (
    !event.dates.start.dateTime ||
    event.dates.start.dateTBD ||
    event.dates.start.dateTBA ||
    event.dates.start.timeTBA ||
    event.dates.start.noSpecificTime ||
    ["cancelled", "postponed"].includes(event.dates.status?.code ?? "")
  )
    return null;
  const venue = event._embedded?.venues?.[0];
  const timeZone = event.dates.timezone ?? venue?.timezone;
  if (!timeZone) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch {
    return null;
  }
  let endsAt = event.dates.end?.dateTime ?? null;
  if (!endsAt && event.dates.end?.localDate && event.dates.end.localTime) {
    const candidates = eventTimeCandidates(
      `${event.dates.end.localDate}T${event.dates.end.localTime.slice(0, 5)}`,
      timeZone,
    );
    if (candidates.length === 1) endsAt = candidates[0];
  }
  if (endsAt && Date.parse(endsAt) <= Date.parse(event.dates.start.dateTime))
    endsAt = null;
  const image = event.images
    ?.filter((image) => image.url.startsWith("https://s1.ticketm.net/dam/"))
    .sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024))[0];
  let sourceUrl: string | null = null;
  try {
    const url = new URL(event.url ?? "");
    if (
      url.protocol === "https:" &&
      (url.hostname === "ticketmaster.com" ||
        url.hostname.endsWith(".ticketmaster.com"))
    )
      sourceUrl = url.href;
  } catch {
    /* No external link is preferable to an untrusted provider URL. */
  }
  return {
    id: event.id,
    name: event.name.slice(0, 100),
    startsAt: new Date(event.dates.start.dateTime).toISOString(),
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    timeZone,
    location: [venue?.name, venue?.city?.name, venue?.state?.stateCode]
      .filter(Boolean)
      .join(", ")
      .slice(0, 300),
    imageUrl: image?.url ?? null,
    sourceUrl,
  };
}

export type EventCatalog = {
  search: (
    query: string,
    page?: number,
  ) => Promise<{ events: CatalogEvent[]; nextPage: number | null }>;
  event: (id: string) => Promise<CatalogEvent>;
};
const cache = new Map<string, { expires: number; value: unknown }>();
let localCalls: number[] = [];
let localDay = "";
let localDailyCalls = 0;
async function providerQuota() {
  if (process.env.NODE_ENV === "development") {
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== localDay) {
      localDay = day;
      localDailyCalls = 0;
    }
    localCalls = localCalls.filter((time) => time > now - 1000);
    if (localCalls.length >= 4 || localDailyCalls >= 500)
      throw new SocialError(
        429,
        "Event search is busy. Please try again shortly.",
      );
    localCalls.push(now);
    localDailyCalls++;
  } else {
    await enforceRateLimit("ticketmasterBurst", "ticketmaster-catalog");
    await enforceRateLimit("ticketmasterDay", "ticketmaster-catalog");
  }
}
async function request(
  path: string,
  params = new URLSearchParams(),
): Promise<unknown> {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key)
    throw new SocialError(
      503,
      "Event search is temporarily unavailable. Please try again later.",
    );
  const cacheKey = `${path}?${params}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  await providerQuota();
  const url = new URL(`https://app.ticketmaster.com/discovery/v2/${path}`);
  params.set("apikey", key);
  url.search = params.toString();
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404)
      throw new SocialError(404, "That event is no longer available.");
    if (
      !response.ok ||
      Number(response.headers.get("content-length") ?? 0) > 2_000_000
    )
      throw Error("Provider unavailable");
    const body = await response.text();
    if (body.length > 2_000_000) throw Error("Provider response too large");
    const value: unknown = JSON.parse(body);
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { expires: Date.now() + 60_000, value });
    return value;
  } catch (error) {
    if (error instanceof SocialError) throw error;
    // Never expose the request URL, which contains the server's API key.
    throw new SocialError(
      503,
      "Event search is temporarily unavailable. Please try again later.",
    );
  }
}
export const ticketmasterCatalog: EventCatalog = {
  async search(query, page = 0) {
    const params = new URLSearchParams({
      keyword: query,
      size: "20",
      page: String(page),
      sort: "date,asc",
      includeTBA: "no",
      includeTBD: "no",
      startDateTime: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    });
    const raw = z
      .object({
        _embedded: z
          .object({ events: z.array(z.unknown()).max(20) })
          .optional(),
        page: z.object({ totalPages: z.number().int().nonnegative() }),
      })
      .parse(await request("events.json", params));
    return {
      events: (raw._embedded?.events ?? [])
        .map(parseTicketmasterEvent)
        .filter((e): e is CatalogEvent => Boolean(e)),
      nextPage: page + 1 < Math.min(raw.page.totalPages, 50) ? page + 1 : null,
    };
  },
  async event(id) {
    const event = parseTicketmasterEvent(
      await request(`events/${encodeURIComponent(id)}.json`),
    );
    if (!event)
      throw new SocialError(409, "This event’s schedule isn’t confirmed yet.");
    return event;
  },
};
