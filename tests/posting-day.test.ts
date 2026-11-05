import { expect, it } from "vitest";
import { postingDayWindow, validTimeZone } from "@/lib/posting-day";

it.each([
  [
    "America/Los_Angeles",
    "2026-03-08T12:00:00Z",
    "2026-03-08T08:00:00.000Z",
    "2026-03-09T07:00:00.000Z",
  ],
  [
    "America/Los_Angeles",
    "2026-11-01T12:00:00Z",
    "2026-11-01T07:00:00.000Z",
    "2026-11-02T08:00:00.000Z",
  ],
  [
    "Asia/Tokyo",
    "2026-11-03T16:00:00Z",
    "2026-11-03T15:00:00.000Z",
    "2026-11-04T15:00:00.000Z",
  ],
])(
  "uses exact saved-zone boundaries including DST: %s %s",
  (zone, instant, start, end) => {
    const window = postingDayWindow(new Date(instant), zone);
    expect(window.start.toISOString()).toBe(start);
    expect(window.end.toISOString()).toBe(end);
  },
);
it("carries recent usage across zone changes without accepting invalid zone names", () => {
  const now = new Date("2026-11-03T20:00:00Z");
  expect(
    postingDayWindow(now, "Asia/Tokyo", {
      from: new Date(now.getTime() - 86_400_000),
      until: new Date(now.getTime() + 86_400_000),
    }).start.toISOString(),
  ).toBe("2026-11-02T20:00:00.000Z");
  expect(validTimeZone("Europe/London")).toBe(true);
  expect(validTimeZone("not/a-zone")).toBe(false);
});
