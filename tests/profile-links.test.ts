import { expect, it } from "vitest";
import {
  profileSignInDestination,
  sharedProfilePath,
} from "@/lib/profile-links";

it("builds a lowercase username address outside the public-page namespace", () => {
  expect(sharedProfilePath("Matt_B")).toBe("/people/matt_b");
  expect(sharedProfilePath("help")).toBe("/people/help");
});

it.each([
  ["/people/matt", "/people/matt"],
  ["https://margin.social/people/Matt_B", "/people/matt_b"],
  [undefined, "/app/feed"],
  [["/people/matt"], "/app/feed"],
  ["https://evil.test/people/matt", "/app/feed"],
  ["//evil.test/people/matt", "/app/feed"],
  ["https://margin.social@evil.test/people/matt", "/app/feed"],
  ["javascript:alert(1)", "/app/feed"],
  ["/app?person=forged", "/app/feed"],
  ["/people/matt?redirect=https://evil.test", "/app/feed"],
  ["/people/matt#redirect", "/app/feed"],
  ["/people/%2F%2Fevil", "/app/feed"],
  ["/people/ma", "/app/feed"],
  ["/people/matt/other", "/app/feed"],
])(
  "limits the sign-in destination %j to an internal profile address",
  (input, expected) => {
    expect(profileSignInDestination(input, "https://margin.social")).toBe(
      expected,
    );
  },
);
