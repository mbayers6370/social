import type { FeedPost } from "./schema";

export const FEED_TIME_ZONE = "America/Los_Angeles";

const calendarDayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: FEED_TIME_ZONE,
});

export function calendarDayLabel(value: string) {
  return calendarDayFormat
    .formatToParts(new Date(value))
    .map(({ type, value }) => (type === "weekday" ? `${value},` : value))
    .join("");
}

export function chronologicalPosts(posts: readonly FeedPost[]) {
  // Copy first: a view must not mutate the server's data or an existing cache entry.
  return [...posts].sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function postTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: FEED_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  })
    .format(new Date(value))
    .toLowerCase();
}

export function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FEED_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function relativeTime(value: string, referenceTime: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.parse(referenceTime) - Date.parse(value)) / 60000),
  );
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h`;
}
