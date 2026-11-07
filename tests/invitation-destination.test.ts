import { expect, it } from "vitest";
import { invitationDestination } from "@/features/account/invitation-destination";
const token = "a".repeat(43);
it("opens shared and personal Margin invitation links inside this app", () => {
  expect(
    invitationDestination(
      `https://margin.social/invite/${token}`,
      "http://localhost:3000",
    ),
  ).toBe(`/invite/${token}`);
  expect(
    invitationDestination(`/invite/claim/${token}`, "https://margin.social"),
  ).toBe(`/invite/claim/${token}`);
  expect(
    invitationDestination(
      `/invite/claim/${token}?__clerk_ticket=verified.provider.ticket`,
      "https://margin.social",
    ),
  ).toBe(`/invite/claim/${token}?__clerk_ticket=verified.provider.ticket`);
});
it("rejects unrelated destinations and malformed invitation links", () => {
  for (const value of [
    `https://evil.invalid/invite/${token}`,
    "javascript:alert(1)",
    "/app",
    `/invite/${token}?next=/app`,
    `/invite/${token}#fragment`,
    "/invite/short",
    `https://me:secret@margin.social/invite/${token}`,
  ])
    expect(invitationDestination(value, "https://margin.social")).toBeNull();
});
