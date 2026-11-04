import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import { FriendsPage } from "@/features/friends/friends-page";
import { MemberFriends } from "@/features/social/member-friends";
import { SpaceClientProvider } from "@/features/spaces/client";
import type { MemberFriends as FriendsData } from "@/features/social/member-contracts";
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
it("keeps four mobile destinations with notifications and account utilities in the header", () => {
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
  ).toEqual(["Feed", "Spaces", "Messages", "Profile"]);
  expect(within(bottom).getByRole("link", { name: "Profile" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
it("keeps the preview count in its tab and scopes the single search to the current list", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <FriendsPage />
    </PreviewProvider>,
  );
  expect(screen.getByRole("button", { name: "Friends · 1" })).toBeVisible();
  expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Search profiles" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Manage friendship/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Theo/ })).toHaveAttribute(
    "href",
    "/?view=profile&person=theo",
  );
  const search = screen.getByRole("searchbox", { name: "Search your friends" });
  expect(search).toHaveAttribute("placeholder", "Search your friends");
  await user.type(search, "Nadia");
  expect(
    screen.getByText("No matches. Try another name or username."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Friends · 1" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: /Requests/ }));
  expect(
    screen.queryByRole("searchbox", { name: "Search your requests" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Nadia")).toBeVisible();
});

it("shows the member friend count and keeps global profile search outside the list", async () => {
  const user = userEvent.setup();
  const initial: FriendsData = {
    contacts: [
      {
        person: {
          id: "friend",
          name: "Alex Example",
          initials: "AE",
          tone: "paper",
        },
        username: "alex_example",
        relationship: "friends",
        friendsSince: "2026-03-12T12:00:00Z",
      },
      {
        person: {
          id: "request",
          name: "Casey Example",
          initials: "CE",
          tone: "paper",
        },
        username: "casey_example",
        relationship: "incoming",
      },
    ],
    nextCursor: null,
  };
  const client = {
    request: async () => Response.json({ activity: [], nextCursor: null }),
    href: (url: string) => url,
    photoSrc: (id: string) => `/api/photos/${id}`,
    preview: false,
  };
  render(
    <SpaceClientProvider client={client}>
      <MemberFriends initial={initial} />
    </SpaceClientProvider>,
  );
  const page = within(
    document.querySelector<HTMLElement>(".margin-friends-page")!,
  );
  expect(page.getByRole("tab", { name: "Friends · 1" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(page.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  expect(
    page.queryByRole("button", { name: "Search profiles" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Search profiles" })).toBeVisible();
  expect(
    page.queryByRole("button", { name: /Manage friendship/ }),
  ).not.toBeInTheDocument();
  const friend = page.getByRole("link", { name: /Alex Example/ });
  expect(friend).toHaveAttribute("href", "/app?person=friend");
  expect(friend).toHaveTextContent("Friends since March ’26");
  expect(friend.querySelector("time")).toHaveAttribute(
    "datetime",
    "2026-03-12T12:00:00.000Z",
  );
  await user.type(
    page.getByRole("searchbox", { name: "Search your friends" }),
    "Casey",
  );
  expect(page.getByText("No matching profiles in this list.")).toBeVisible();
  expect(page.getByRole("tab", { name: "Friends · 1" })).toBeVisible();
  await user.click(page.getByRole("tab", { name: "Requests" }));
  expect(
    page.queryByRole("searchbox", { name: "Search your requests" }),
  ).not.toBeInTheDocument();
  expect(page.getByText("Casey Example")).toBeVisible();
});

it.each([0, 10, 11])(
  "shows request search only above ten entries (%i requests)",
  async (count) => {
    const user = userEvent.setup();
    const initial: FriendsData = {
      contacts: Array.from({ length: count }, (_, index) => ({
        person: {
          id: `person-${index}`,
          name: `Person ${index}`,
          initials: "P",
          tone: "paper",
        },
        username: `person_${index}`,
        relationship: index % 2 ? "outgoing" : "incoming",
      })),
      nextCursor: null,
    };
    const client = {
      request: async () => Response.json({ activity: [], nextCursor: null }),
      href: (url: string) => url,
      photoSrc: (id: string) => `/api/photos/${id}`,
      preview: false,
    };
    render(
      <SpaceClientProvider client={client}>
        <MemberFriends initial={initial} />
      </SpaceClientProvider>,
    );
    const page = within(
      document.querySelector<HTMLElement>(".margin-friends-page")!,
    );
    await user.click(page.getByRole("tab", { name: "Requests" }));
    if (count > 10) {
      const search = page.getByRole("searchbox", {
        name: "Search your requests",
      });
      await user.type(search, "Person 10");
      expect(page.getByText("Person 10")).toBeVisible();
      expect(
        page.queryByText("Person 0", { exact: true }),
      ).not.toBeInTheDocument();
      expect(search).toBeVisible();
      expect(
        within(page.getByRole("region", { name: "Sent" })).queryByText("0", {
          exact: true,
        }),
      ).not.toBeInTheDocument();
    } else expect(page.queryByRole("searchbox")).not.toBeInTheDocument();
    if (count === 0) {
      expect(page.getByText("No requests right now.")).toBeVisible();
      expect(
        page.queryByRole("heading", { name: "Received" }),
      ).not.toBeInTheDocument();
      expect(
        page.queryByRole("heading", { name: "Sent" }),
      ).not.toBeInTheDocument();
      expect(
        page.getByRole("button", { name: "Invite someone" }),
      ).toBeVisible();
    }
  },
);

it("accepts a request, updates the tab count and makes the new friend row open their profile", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <FriendsPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: /Requests 1 new/ }));
  await user.click(
    within(screen.getByRole("region", { name: "Received" })).getByRole(
      "button",
      { name: "Accept request" },
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "You and Nadia are now friends.",
  );
  await user.click(screen.getByRole("button", { name: "Friends · 2" }));
  const row = screen.getByRole("link", { name: /Nadia/ });
  expect(row).toHaveAttribute("href", "/?view=profile&person=nadia");
  expect(row).toHaveTextContent("Friends since");
  expect(row.querySelector("time")).not.toBeNull();
  expect(
    screen.queryByRole("button", { name: /Manage friendship/ }),
  ).not.toBeInTheDocument();
});
it("keeps small request lists unfiltered and combines their empty state without hiding status feedback", async () => {
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
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Decline" }));
  expect(screen.getByText("No requests right now.")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Received" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Sent" }),
  ).not.toBeInTheDocument();
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
