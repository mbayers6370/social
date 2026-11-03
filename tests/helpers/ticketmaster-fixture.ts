import type { CatalogEvent } from "@/features/spaces/contracts";
export const calvinProviderEvent = {
  id: "Z7r9jZ1AAv9uI",
  name: "Calvin Harris (21 and Over)",
  url: "https://www.ticketmaster.com/event/Z7r9jZ1AAv9uI",
  dates: {
    start: { dateTime: "2026-11-08T06:30:00Z" },
    status: { code: "onsale" },
  },
  images: [
    {
      url: "https://s1.ticketm.net/dam/a/259/9afb1a6e-3bf4-4fa7-a4f1-0c2602b90259_TABLET_LANDSCAPE_16_9.jpg",
      width: 1024,
      ratio: "16_9",
    },
  ],
  _embedded: {
    venues: [
      {
        name: "XS Nightclub at Wynn Las Vegas",
        timezone: "America/Los_Angeles",
        city: { name: "Las Vegas" },
        state: { stateCode: "NV" },
      },
    ],
  },
};
export const calvinEvent: CatalogEvent = {
  id: calvinProviderEvent.id,
  name: calvinProviderEvent.name,
  startsAt: "2026-11-08T06:30:00.000Z",
  endsAt: null,
  timeZone: "America/Los_Angeles",
  location: "XS Nightclub at Wynn Las Vegas, Las Vegas, NV",
  imageUrl: calvinProviderEvent.images[0].url,
  sourceUrl: calvinProviderEvent.url,
};
