import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { previewBootstrap } from "./helpers/local-preview-fixture";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("puts New Post before Edit and Settings and opens the composer from the identity", async () => {
  const user = userEvent.setup();
  const data = previewBootstrap();
  const { container } = render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  const actions = container.querySelector(".margin-profile-actions")!;
  expect(
    [...actions.children].map((action) => action.getAttribute("aria-label")),
  ).toEqual(["New Post", "Edit profile", "Settings"]);
  expect(
    within(screen.getByRole("region", { name: "Recent Posts" })).queryByRole(
      "button",
      { name: "New Post" },
    ),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "New Post" }));
  expect(await screen.findByRole("dialog", { name: "New Post" })).toBeVisible();
});

it("puts personal sections before the post stream in reading and keyboard order", () => {
  const data = previewBootstrap();
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  expect(
    screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent),
  ).toEqual(["On Repeat", "Gallery", "Recent Posts"]);
  const gallery = screen.getByRole("region", { name: "Gallery" });
  expect(
    within(gallery).getByRole("link", { name: "View all 4 photographs" }),
  ).toHaveAttribute("href", "/?view=gallery");
  expect(within(gallery).getAllByRole("img")).toHaveLength(3);
});

it("names the friendship state visibly and keeps unfriend in the options menu", async () => {
  const user = userEvent.setup();
  const data = previewBootstrap();
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[1]} />
    </PreviewProvider>,
  );
  const friendship = screen.getByRole("img", {
    name: "Friends with Theo Marchetti",
  });
  expect(friendship).toHaveTextContent("Friends");
  expect(
    screen.getByRole("link", { name: "Message Theo Marchetti" }),
  ).toHaveAttribute("href", "/?view=messages&thread=theo");
  expect(
    screen.queryByRole("button", { name: "Unfriend" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "More options for Theo Marchetti" }),
  );
  await user.click(
    within(screen.getByRole("dialog", { name: "Profile options" })).getByRole(
      "button",
      { name: "Unfriend" },
    ),
  );
  await user.click(
    within(
      screen.getByRole("alertdialog", { name: "Unfriend Theo Marchetti?" }),
    ).getByRole("button", { name: "Unfriend" }),
  );
  expect(
    screen.queryByRole("img", { name: "Friends with Theo Marchetti" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Message Theo Marchetti" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add friend" })).toBeVisible();
  expect(screen.getByText("Posts are shared with friends.")).toBeVisible();
  expect(screen.getByText("Photos are shared with friends.")).toBeVisible();
});

it.each(["none", "incoming", "outgoing", "blocked"] as const)(
  "keeps all three cards but omits their contents for a %s relationship",
  (relationship) => {
    const data = previewBootstrap();
    const target = data.profiles[1];
    target.photos = [
      { ...data.photos[0], description: "PRIVATE_PHOTO_MARKER" },
    ];
    target.onRepeat = [
      {
        id: "private-song",
        title: "PRIVATE_SONG_MARKER",
        artist: "Private artist",
        artwork: data.photos[0].image,
      },
    ];
    target.recent = [
      { id: "private-legacy", date: "Today", body: "PRIVATE_LEGACY_MARKER" },
    ];
    data.posts = [
      {
        id: "private-post",
        author: target.person,
        createdAt: data.now,
        expiresAt: "2026-11-26T20:00:00Z",
        paragraphs: ["PRIVATE_POST_MARKER"],
        likes: 0,
        comments: [],
        audience: "friends",
      },
    ];
    data.friendships =
      relationship === "none"
        ? []
        : [
            {
              people: ["ines", "theo"],
              status: relationship === "blocked" ? "blocked" : "pending",
              requestedBy: relationship === "incoming" ? "theo" : "ines",
              ...(relationship === "blocked" ? { blockedBy: "ines" } : {}),
            },
          ];
    render(
      <PreviewProvider bootstrap={data}>
        <ProfilePreview profile={target} />
      </PreviewProvider>,
    );
    for (const [name, copy] of [
      ["On Repeat", "Songs are shared with friends."],
      ["Gallery", "Photos are shared with friends."],
      ["Recent Posts", "Posts are shared with friends."],
    ]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getByText(copy)).toBeVisible();
      expect(within(section).queryByRole("img")).not.toBeInTheDocument();
    }
    for (const marker of [
      "PRIVATE_PHOTO_MARKER",
      "PRIVATE_SONG_MARKER",
      "PRIVATE_LEGACY_MARKER",
      "PRIVATE_POST_MARKER",
    ])
      expect(screen.queryByText(marker)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /View all .*photographs/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Open PRIVATE_SONG/ }),
    ).not.toBeInTheDocument();
  },
);
