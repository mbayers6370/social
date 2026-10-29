import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import { FriendsPage } from "@/features/friends/friends-page";
import { FriendActions } from "@/features/friends/friend-actions";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { MarginNavigation } from "@/components/layout/margin-navigation";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { GalleryPage } from "@/features/gallery/gallery-page";
import { FeedExperience } from "@/features/feed/feed-experience";
import {
  notificationFixture,
  notificationNow,
} from "./helpers/notification-fixture";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1024px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());
it("keeps three mobile destinations with notifications and account utilities in the header", () => {
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <MarginNavigation active="profile" profileAvatar={<span>IA</span>} />
    </PreviewProvider>,
  );
  const header = screen.getByRole("banner");
  const bottom = screen.getByRole("navigation", { name: "Mobile navigation" });
  expect(
    within(header).queryByRole("button", { name: "New Post" }),
  ).not.toBeInTheDocument();
  expect(
    within(bottom).queryByRole("button", { name: "New Post" }),
  ).not.toBeInTheDocument();
  expect(
    within(header).getByRole("button", { name: "Notifications, 2 unread" }),
  ).toBeInTheDocument();
  expect(
    within(header).getByRole("button", { name: "Profile menu" }),
  ).toBeInTheDocument();
  expect(within(bottom).queryByRole("button")).not.toBeInTheDocument();
  expect(
    within(bottom)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["Feed", "Messages", "Profile"]);
  expect(within(bottom).getByRole("link", { name: "Profile" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
it("accepts a request, updates friends, confirms removal with safe focus and supports cancelling that confirmation", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <FriendsPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: /Requests 1 new/ }));
  const received = screen.getByRole("region", { name: "Received" });
  await user.click(
    within(received).getByRole("button", { name: "Accept request" }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "You and Nadia are now friends.",
  );
  expect(screen.getByText("No requests waiting for you.")).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Friends" })).toHaveFocus(),
  );
  await user.click(screen.getByRole("button", { name: "Friends 2" }));
  const manage = screen.getByRole("button", {
    name: "Manage friendship with Nadia",
  });
  await user.click(manage);
  let dialog = screen.getByRole("alertdialog", {
    name: "Remove Nadia from friends?",
  });
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(manage).toHaveFocus());
  expect(screen.getByRole("button", { name: "Friends 2" })).toBeInTheDocument();
  await user.click(manage);
  dialog = screen.getByRole("alertdialog");
  await user.click(
    within(dialog).getByRole("button", { name: "Remove friend" }),
  );
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Nadia removed from friends.",
  );
  expect(screen.getByRole("button", { name: "Friends 1" })).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Friends" })).toHaveFocus(),
  );
});
it("shows sent requests, supports cancellation and decline, and filters without hiding status feedback", async () => {
  const user = userEvent.setup();
  const { bootstrap } = notificationFixture();
  bootstrap.friendships = [
    { people: ["ines", "theo"], status: "pending", requestedBy: "ines" },
    ...bootstrap.friendships.filter((pair) => pair.people.includes("nadia")),
  ];
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <FriendsPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: /Requests/ }));
  await user.click(
    within(screen.getByRole("region", { name: "Sent" })).getByRole("button", {
      name: "Cancel request",
    }),
  );
  expect(screen.getByText("No outgoing requests.")).toBeVisible();
  await user.type(screen.getByRole("searchbox"), "no such name");
  expect(
    screen.getAllByText("No matches. Try another name or username."),
  ).toHaveLength(2);
  await user.clear(screen.getByRole("searchbox"));
  await user.click(screen.getByRole("button", { name: "Decline" }));
  expect(screen.getByText("No requests waiting for you.")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Friend request from Nadia declined.",
  );
});
it("adds and cancels a request from a profile without granting friend-only access", async () => {
  const user = userEvent.setup();
  const { bootstrap } = notificationFixture();
  bootstrap.friendships = [];
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <ProfilePreview profile={bootstrap.profiles[1]} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Add friend" }));
  expect(screen.getByText("Request sent")).toBeVisible();
  expect(screen.getByText("Posts are shared with friends.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Cancel request" }));
  expect(screen.getByRole("button", { name: "Add friend" })).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("accepts from notifications and immediately synchronizes the profile controls and unread count", async () => {
  const user = userEvent.setup();
  const { bootstrap } = notificationFixture();
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <NotificationCenter />
      <FriendActions person={bootstrap.profiles[2].person} />
    </PreviewProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Notifications, 2 unread" }),
  );
  const panel = screen.getByRole("dialog", { name: "Notifications" });
  await user.click(
    within(panel).getByRole("button", { name: "Accept request" }),
  );
  expect(
    within(panel).queryByText("Nadia sent you a friend request."),
  ).not.toBeInTheDocument();
  expect(within(panel).getByRole("status")).toHaveTextContent(
    "You and Nadia are now friends.",
  );
  expect(
    screen.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Manage friendship with Nadia" }),
  ).toBeVisible();
});
it("revokes already-serialized feed, profile and gallery content immediately on removal", async () => {
  const user = userEvent.setup();
  const { bootstrap, post } = notificationFixture();
  const photo = {
    description: "Private photograph",
    caption: "Sample",
    aspect: "landscape" as const,
    image: { src: "/_next/static/media/private.jpg", width: 640, height: 480 },
  };
  bootstrap.profiles[1].photos = [photo];
  bootstrap.profiles[1].recent = [
    { id: "private", date: "27 Oct", body: "Private recent thought" },
  ];
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <ProfilePreview profile={bootstrap.profiles[1]} />
      <GalleryPage personId="theo" />
      <FeedExperience
        posts={[{ ...post, author: bootstrap.profiles[1].person }]}
        referenceTime={notificationNow}
        renderedPosts={{}}
      />
    </PreviewProvider>,
  );
  const profileGallery = document.querySelector(
    ".margin-profile-gallery",
  ) as HTMLElement;
  expect(
    within(profileGallery).getByRole("link", { name: "View More" }),
  ).toBeVisible();
  expect(screen.getByText("Something worth discussing.")).toBeVisible();
  expect(screen.getByText("Private recent thought")).toBeVisible();
  expect(screen.getAllByAltText("Private photograph").length).toBeGreaterThan(
    0,
  );
  await user.click(
    screen.getByRole("button", { name: "More options for Theo" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Unfriend" }));
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Unfriend",
    }),
  );
  expect(
    screen.queryByText("Something worth discussing."),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Private recent thought")).not.toBeInTheDocument();
  expect(screen.queryByAltText("Private photograph")).not.toBeInTheDocument();
  expect(
    within(profileGallery).queryByRole("link", { name: "View More" }),
  ).not.toBeInTheDocument();
  expect(
    within(profileGallery).getByText("Photos are shared with friends."),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Gallery Unavailable" }),
  ).toBeVisible();
});
it("dismisses an open conversation immediately if its friend-only post loses access", async () => {
  const user = userEvent.setup();
  const { bootstrap, post } = notificationFixture();
  let revoke: (() => void) | undefined;
  function RemoveFixture() {
    const { changeFriend } = usePreview();
    useEffect(() => {
      revoke = () => changeFriend("theo", "remove");
    }, [changeFriend]);
    return null;
  }
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <RemoveFixture />
      <FeedExperience
        posts={[{ ...post, author: bootstrap.profiles[1].person }]}
        referenceTime={notificationNow}
        renderedPosts={{}}
      />
    </PreviewProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Conversation on Theo’s post" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Conversation on Theo’s post" }),
  ).toBeVisible();
  // Simulate an external relationship update while the modal owns focus.
  act(() => revoke?.());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Something worth discussing."),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(window.location.hash).not.toContain("conversation-"),
  );
});
