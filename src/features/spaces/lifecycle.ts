import type { SpaceSummary } from "./contracts";
export const EVENT_AFTER_HOURS = 48;
export const EVENT_DURATION_HOURS = 4;
export function defaultEventEnd(startsAt: string | Date) {
  return new Date(
    new Date(startsAt).getTime() + EVENT_DURATION_HOURS * 3600_000,
  );
}
export function validEventEnd(startsAt: string | Date, endsAt: string | Date) {
  const end = new Date(endsAt).getTime();
  const start = new Date(startsAt).getTime();
  return Number.isFinite(end) && end > start && end <= start + 30 * 86400_000;
}
export function eventExpiry(endsAt: string | Date) {
  return new Date(new Date(endsAt).getTime() + EVENT_AFTER_HOURS * 3600_000);
}
export function isSpaceExpired(
  space: Pick<SpaceSummary, "expiresAt">,
  now: number,
) {
  return Boolean(space.expiresAt && Date.parse(space.expiresAt) <= now);
}
export const spaceKindLabel = (kind: SpaceSummary["kind"]) =>
  kind === "EVENT" ? "Event Space" : "Space";

/** Existing database constraints distinguish scheduled private rooms internally. */
export const privateSpaceStorageKind = (startsAt?: string) =>
  startsAt ? ("GATHERING" as const) : ("PRIVATE" as const);
