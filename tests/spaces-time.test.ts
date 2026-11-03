import { expect, it } from "vitest";
import {
  eventTimeCandidates,
  eventLocalValue,
} from "@/features/spaces/event-time";
it("keeps the selected time zone instead of the browser zone", () => {
  expect(eventTimeCandidates("2027-01-01T18:00", "Asia/Tokyo")).toEqual([
    "2027-01-01T09:00:00.000Z",
  ]);
  expect(eventLocalValue("2027-01-01T09:00:00Z", "Asia/Tokyo")).toBe(
    "2027-01-01T18:00",
  );
});
it("never invents a time through daylight-saving gaps or folds", () => {
  expect(
    eventTimeCandidates("2026-03-08T02:30", "America/Los_Angeles"),
  ).toEqual([]);
  expect(
    eventTimeCandidates("2026-11-01T01:30", "America/Los_Angeles"),
  ).toEqual(["2026-11-01T08:30:00.000Z", "2026-11-01T09:30:00.000Z"]);
});
