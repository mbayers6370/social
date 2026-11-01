import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { getDevelopmentSocial } from "@/server/fixtures/social";
import { getDevelopmentNadiaContent } from "@/server/fixtures/nadia";
import { loadDevelopmentFriendProfile } from "@/server/fixtures/friend-profile-action";
import { friendStatus } from "@/features/friends/model";
import type { FriendProfileContent } from "@/features/local-preview/model";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function setup() {
  const data = getDevelopmentSocial();
  data.now = "2026-10-28T20:00:00Z";
  const profile = data.profiles.find(
    (profile) => profile.person.id === "nadia",
  )!;
  return { data, profile };
}
it("keeps Nadia pending with a public scientist bio and portrait but no serialized private content", () => {
  const { data, profile } = setup();
  expect(profile.bio).toContain("Scientist");
  expect(profile.person.photo?.src).toContain("Haddad-3");
  expect(friendStatus(data.viewerId, "nadia", data.friendships)).toBe(
    "incoming",
  );
  expect(profile.photos).toEqual([]);
  expect(profile.recent).toEqual([]);
  expect(profile.onRepeat).toEqual([]);
  expect(JSON.stringify(data)).not.toMatch(
    /post-nadia-|Haddad-concert|sample-nadia-teardrop/,
  );
});
it("loads her complete profile only after acceptance and keeps it hidden again after unfriending", async () => {
  const user = userEvent.setup();
  const { data, profile } = setup();
  const content = getDevelopmentNadiaContent();
  const load = vi.fn(async () => content);
  render(
    <PreviewProvider bootstrap={data} loadFriendProfileAction={load}>
      <ProfilePreview profile={profile} />
    </PreviewProvider>,
  );
  expect(load).not.toHaveBeenCalled();
  expect(screen.getByText("Songs are shared with friends.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Accept request" }));
  await waitFor(() =>
    expect(
      screen.getByRole("img", { name: "Friends with Nadia Haddad" }),
    ).toBeVisible(),
  );
  expect(load).toHaveBeenCalledExactlyOnceWith("nadia");
  expect(
    within(screen.getByRole("region", { name: "Gallery" })).getAllByRole("img"),
  ).toHaveLength(3);
  expect(
    screen.getByRole("button", { name: "Open Teardrop by Massive Attack" }),
  ).toBeVisible();
  for (const post of content.posts)
    expect(screen.getByText(post.paragraphs[0])).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "More options for Nadia Haddad" }),
  );
  await user.click(
    within(screen.getByRole("dialog", { name: "Profile options" })).getByRole(
      "button",
      { name: "Unfriend" },
    ),
  );
  await user.click(
    within(
      screen.getByRole("alertdialog", { name: "Unfriend Nadia Haddad?" }),
    ).getByRole("button", { name: "Unfriend" }),
  );
  expect(screen.getByText("Songs are shared with friends.")).toBeVisible();
  expect(screen.getByText("Photos are shared with friends.")).toBeVisible();
  expect(screen.getByText("Posts are shared with friends.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Open Teardrop by Massive Attack" }),
  ).not.toBeInTheDocument();
});
it("leaves the request pending if content loading fails and permits a successful retry", async () => {
  const user = userEvent.setup();
  const { data, profile } = setup();
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("Temporary failure"))
    .mockResolvedValueOnce(getDevelopmentNadiaContent());
  render(
    <PreviewProvider bootstrap={data} loadFriendProfileAction={load}>
      <ProfilePreview profile={profile} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Accept request" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t accept the request. Please try again.",
    ),
  );
  expect(screen.getByText("Photos are shared with friends.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Accept request" }));
  await waitFor(() =>
    expect(
      screen.getByRole("img", { name: "Friends with Nadia Haddad" }),
    ).toBeVisible(),
  );
});
it("does not apply an acceptance that finishes after the profile is blocked", async () => {
  const user = userEvent.setup();
  const { data, profile } = setup();
  const response = Promise.withResolvers<FriendProfileContent>();
  const load = vi.fn(() => response.promise);
  render(
    <PreviewProvider bootstrap={data} loadFriendProfileAction={load}>
      <ProfilePreview profile={profile} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Accept request" }));
  expect(screen.getByRole("button", { name: "Accepting…" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "More options for Nadia Haddad" }),
  );
  await user.click(
    within(screen.getByRole("dialog", { name: "Profile options" })).getByRole(
      "button",
      { name: "Block profile" },
    ),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Block Nadia Haddad?" }),
    ).getByRole("button", { name: "Block" }),
  );
  await act(async () => response.resolve(getDevelopmentNadiaContent()));
  expect(screen.getByText("Friend requests unavailable")).toBeVisible();
  expect(screen.getByText("Songs are shared with friends.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Open Teardrop by Massive Attack" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Photos are shared with friends.")).toBeVisible();
  expect(screen.getByText("Posts are shared with friends.")).toBeVisible();
});
it.each(["test", "production"])(
  "cannot return development profile data in %s",
  async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    await expect(loadDevelopmentFriendProfile("nadia")).rejects.toThrow(
      "Development fixtures are unavailable",
    );
  },
);
