import { describe, expect, it } from "vitest";
import {
  containsPostLink,
  postingEligibility,
  type PostingRecord,
} from "@/lib/platform-rules";
const now = new Date("2026-10-27T21:00:00Z");
const record = (id: string, hasLink = false): PostingRecord => ({
  id,
  authorId: "ines",
  createdAt: now.toISOString(),
  hasLink,
});
describe("daily posting policy", () => {
  it("counts individual photographs across posts and restores the allowance after local midnight or deletion", () => {
    const records = [{ ...record("photos"), imageCount: 2 }];
    expect(
      postingEligibility(records, "ines", now, false, undefined, 1).allowed,
    ).toBe(true);
    expect(
      postingEligibility(records, "ines", now, false, undefined, 2).allowed,
    ).toBe(false);
    expect(
      postingEligibility(records, "ines", now, false).imagesRemaining,
    ).toBe(1);
    const full = [{ ...record("three-photos"), imageCount: 3 }];
    expect(postingEligibility(full, "ines", now, false).allowed).toBe(true);
    expect(
      postingEligibility(full, "ines", now, false, undefined, 1).allowed,
    ).toBe(false);
    expect(
      postingEligibility(full, "theo", now, false, undefined, 3).allowed,
    ).toBe(true);
    expect(
      postingEligibility(
        full,
        "ines",
        new Date("2026-10-28T06:59:59Z"),
        false,
        undefined,
        1,
      ).allowed,
    ).toBe(false);
    expect(
      postingEligibility(
        full,
        "ines",
        new Date("2026-10-28T07:00:00Z"),
        false,
        undefined,
        3,
      ).allowed,
    ).toBe(true);
    expect(
      postingEligibility(full, "ines", now, false, "three-photos", 3).allowed,
    ).toBe(true);
    expect(
      postingEligibility(
        [{ ...full[0], deleted: true }],
        "ines",
        now,
        false,
        undefined,
        3,
      ).allowed,
    ).toBe(true);
  });
  it("permits three regular posts or one exclusive link-containing post", () => {
    expect(postingEligibility([], "ines", now, true).allowed).toBe(true);
    for (let count = 0; count < 3; count++)
      expect(
        postingEligibility(
          Array.from({ length: count }, (_, i) => record(`${i}`)),
          "ines",
          now,
          false,
        ).allowed,
      ).toBe(true);
    expect(
      postingEligibility(
        [record("1"), record("2"), record("3")],
        "ines",
        now,
        false,
      ).allowed,
    ).toBe(false);
    expect(postingEligibility([record("1")], "ines", now, true).allowed).toBe(
      false,
    );
    for (const hasLink of [false, true])
      expect(
        postingEligibility([record("1", true)], "ines", now, hasLink).allowed,
      ).toBe(false);
  });
  it("recalculates from remaining records after deletion or editing links", () => {
    const two = [record("1"), record("2")];
    const old = { ...record("old"), createdAt: "2026-10-26T20:00:00Z" };
    expect(
      postingEligibility([old, record("today", true)], "ines", now, true, "old")
        .allowed,
    ).toBe(true);

    expect(postingEligibility(two, "ines", now, true, "1").allowed).toBe(false);
    expect(postingEligibility([two[0]], "ines", now, true, "1").allowed).toBe(
      true,
    );
    expect(
      postingEligibility([record("1", true)], "ines", now, false, "1").allowed,
    ).toBe(true);
    expect(
      postingEligibility([record("1", false)], "ines", now, false)
        .regularRemaining,
    ).toBe(2);
    expect(
      postingEligibility(
        [{ ...record("1", true), deleted: true }],
        "ines",
        now,
        false,
      ).regularRemaining,
    ).toBe(3);
    expect(
      postingEligibility(
        [record("1"), record("2"), { ...record("3"), deleted: true }],
        "ines",
        now,
        false,
      ).allowed,
    ).toBe(true);
  });
  it("scopes the calendar day and author, including DST boundaries", () => {
    const records = [record("1", true)];
    expect(postingEligibility(records, "theo", now, false).allowed).toBe(true);
    expect(
      postingEligibility(
        records,
        "ines",
        new Date("2026-10-28T06:59:59Z"),
        false,
      ).allowed,
    ).toBe(false);
    expect(
      postingEligibility(
        records,
        "ines",
        new Date("2026-10-28T07:00:00Z"),
        false,
      ).allowed,
    ).toBe(true);
    const spring = [
      { ...record("1", true), createdAt: "2026-03-08T08:00:00Z" },
    ];
    expect(
      postingEligibility(
        spring,
        "ines",
        new Date("2026-03-09T06:59:59Z"),
        false,
      ).allowed,
    ).toBe(false);
    expect(
      postingEligibility(
        spring,
        "ines",
        new Date("2026-03-09T07:00:00Z"),
        false,
      ).allowed,
    ).toBe(true);
  });
  it("counts pasted links as links independently of the composer mode", () => {
    for (const body of [
      "Read https://example.com/story",
      "Look at www.example.org",
      "example.photography/photo",
    ])
      expect(containsPostLink({ kind: "post", body })).toBe(true);
    expect(
      containsPostLink({ kind: "post", body: "A quiet morning.", url: "" }),
    ).toBe(false);
    expect(containsPostLink({ kind: "link", url: "https://example.com" })).toBe(
      true,
    );
    expect(
      containsPostLink({ paragraphs: ["A thought.", "https://example.com"] }),
    ).toBe(true);
  });
});
