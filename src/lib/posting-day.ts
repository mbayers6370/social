/** One saved IANA zone owns a member's calendar allowance; host time never does. */
export const DEFAULT_POSTING_TIME_ZONE = "America/Los_Angeles";
export function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function postingDayKey(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function postingDayWindow(
  now: Date,
  timeZone: string,
  carry?: { from: Date | null; until: Date | null },
) {
  const key = postingDayKey(now, timeZone);
  // Binary search handles 23/25-hour days and zones whose midnight is skipped.
  const boundary = (after: boolean) => {
    let low = now.getTime() + (after ? 0 : -48 * 3_600_000);
    let high = now.getTime() + (after ? 48 * 3_600_000 : 0);
    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);
      const day = postingDayKey(new Date(middle), timeZone);
      if (after ? day <= key : day < key) low = middle;
      else high = middle;
    }
    return high;
  };
  const start = boundary(false);
  const transition = carry?.from && carry.until && now < carry.until;
  return {
    start: new Date(
      transition ? Math.min(start, carry.from!.getTime()) : start,
    ),
    end: new Date(boundary(true)),
    timeZone,
    key,
  };
}
