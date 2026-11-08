import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTRAIT_CROP,
  portraitCropBounds,
  portraitCropSchema,
} from "@/lib/portrait-crop";
import { memberPerson } from "@/lib/member-person";
import { memberPortraitInput } from "@/features/social/member-schema";

describe("portrait framing", () => {
  it.each([
    [1200, 800],
    [800, 1200],
    [801, 801],
    [1, 1],
  ])("keeps every crop filled for %s × %s", (width, height) => {
    for (const x of [0, 0.5, 1])
      for (const y of [0, 0.5, 1])
        for (const zoom of [1, 1.37, 3]) {
          const bounds = portraitCropBounds(width, height, { x, y, zoom });
          expect(bounds.width).toBe(bounds.height);
          expect(bounds.width).toBeGreaterThanOrEqual(1);
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.top).toBeGreaterThanOrEqual(0);
          expect(bounds.left + bounds.width).toBeLessThanOrEqual(width);
          expect(bounds.top + bounds.height).toBeLessThanOrEqual(height);
        }
  });
  it("supports both edges and zoom without changing the original's proportions", () => {
    expect(portraitCropBounds(1200, 800, { x: 1, y: 0, zoom: 2 })).toEqual({
      left: 800,
      top: 0,
      width: 400,
      height: 400,
    });
  });
  it.each([
    { x: -0.01, y: 0.5, zoom: 1 },
    { x: 1.01, y: 0.5, zoom: 1 },
    { x: 0.5, y: NaN, zoom: 1 },
    { x: 0.5, y: 0.5, zoom: 0.99 },
    { x: 0.5, y: 0.5, zoom: 3.01 },
    { x: Infinity, y: 0.5, zoom: 1 },
  ])("rejects invalid framing %j", (crop) => {
    expect(portraitCropSchema.safeParse(crop).success).toBe(false);
    expect(
      memberPortraitInput.safeParse({ photoId: "own-photo", crop }).success,
    ).toBe(false);
  });
  it("changes portrait URLs for the same photograph when its framing changes", () => {
    const original = memberPerson("member", {
      displayName: "Sample",
      portraitPhotoId: "photo",
    });
    expect(
      memberPerson("member", {
        displayName: "Sample",
        portraitPhotoId: "photo",
        portraitCrop: DEFAULT_PORTRAIT_CROP,
      }),
    ).toEqual(original);
    const reframed = memberPerson("member", {
      displayName: "Sample",
      portraitPhotoId: "photo",
      portraitCrop: { x: 0, y: 1, zoom: 2 },
    });
    expect(reframed.photo?.src).not.toBe(original.photo?.src);
    expect(reframed.photo?.src).toContain("/api/profiles/member/portrait?");
  });
});
