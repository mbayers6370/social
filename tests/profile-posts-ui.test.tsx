import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { FeedExperience } from "@/features/feed/feed-experience";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { previewBootstrap as bootstrap } from "./helpers/local-preview-fixture";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("keeps profile editing visible, moves deletion into the editor and preserves photos", async () => {
  const data = bootstrap();
  const post = {
    id: "post-owned",
    author: data.profiles[0].person,
    createdAt: data.now,
    expiresAt: "2026-11-26T20:00:00Z",
    paragraphs: ["My original thought."],
    likes: 2,
    comments: [],
    audience: "friends" as const,
    media: [data.photos[0]],
  };
  const friend = {
    ...post,
    id: "post-friend",
    author: data.profiles[1].person,
    paragraphs: ["A friend's thought."],
    media: undefined,
  };
  data.posts = [post, friend];
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
      <FeedExperience
        posts={[post, friend]}
        referenceTime={data.now}
        renderedPosts={{}}
      />
    </PreviewProvider>,
  );
  const own = screen.getByRole("article", { name: "Ines Alvarez" });
  expect(within(own).queryByRole("heading")).not.toBeInTheDocument();
  expect(own.querySelector(".margin-avatar")).not.toBeInTheDocument();
  expect(
    within(own).queryByRole("link", { name: /profile/ }),
  ).not.toBeInTheDocument();
  const dates = own.querySelectorAll(".margin-post-details time");
  expect([...dates].map((date) => date.textContent)).toEqual([
    "Posted 27 Oct",
    "Expires 26 Nov",
  ]);
  expect(dates[0]).toHaveAttribute("datetime", post.createdAt);
  expect(dates[1]).toHaveAttribute("datetime", post.expiresAt);
  expect(
    within(screen.getByRole("article", { name: "Theo Marchetti" })).getByRole(
      "heading",
      { name: "Theo Marchetti" },
    ),
  ).toBeVisible();
  const feedPost = screen.getByRole("article", { name: "Theo Marchetti" });
  const conversation = within(feedPost).getByRole("button", {
    name: "Conversation on Theo Marchetti’s post",
  });
  expect(feedPost.querySelector(".margin-post-author")).toContainElement(
    conversation,
  );
  expect(
    within(feedPost).getByRole("button", { name: "Report post" }),
  ).toBeVisible();
  expect(
    within(feedPost).queryByRole("button", { name: "Edit post" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText("My original thought.")).toHaveLength(1);
  expect(screen.getByText("A friend's thought.")).toBeVisible();
  expect(within(own).queryByText("2 likes")).not.toBeInTheDocument();
  const actions = within(own).getByRole("group", { name: "Post actions" });
  const edit = within(actions).getByRole("button", { name: "Edit post" });
  expect(
    within(actions).getByRole("button", {
      name: "Conversation on Ines Alvarez’s post",
    }),
  ).toBeVisible();
  expect(
    within(own).queryByRole("button", { name: "Delete post" }),
  ).not.toBeInTheDocument();
  await user.click(edit);
  const dialog = await screen.findByRole("dialog", { name: "Edit Post" });
  const input = within(dialog).getByRole("textbox", { name: "Your post" });
  expect(input).toHaveValue("My original thought.");
  expect(
    within(dialog).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  await user.clear(input);
  await user.type(input, "My revised thought.");
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await waitFor(() => expect(edit).toHaveFocus());
  expect(within(own).getByText("My revised thought.")).toBeVisible();
  expect(screen.queryByText("My original thought.")).not.toBeInTheDocument();
  await user.click(edit);
  const reopened = await screen.findByRole("dialog", { name: "Edit Post" });
  expect(
    within(reopened).getByRole("button", { name: "Delete post" }),
  ).not.toBeVisible();
  await user.click(within(reopened).getByLabelText("Post options"));
  const remove = within(reopened).getByRole("button", { name: "Delete post" });
  await user.click(remove);
  let confirmation = screen.getByRole("alertdialog", {
    name: "Delete this post?",
  });
  expect(
    within(confirmation).getByRole("button", { name: "Keep post" }),
  ).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(remove).toHaveFocus());
  expect(own).toBeInTheDocument();
  await user.click(remove);
  confirmation = screen.getByRole("alertdialog", { name: "Delete this post?" });
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete post" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Recent Posts" })).toHaveFocus(),
  );
  expect(screen.queryByText("My revised thought.")).not.toBeInTheDocument();
  expect(screen.getByText("Post deleted.")).toBeVisible();
});

it("never exposes owner controls on somebody else's profile", () => {
  const data = bootstrap();
  data.posts = [
    {
      id: "post-friend",
      author: data.profiles[1].person,
      createdAt: data.now,
      expiresAt: "2026-11-26T20:00:00Z",
      paragraphs: ["A friend's post."],
      likes: 0,
      comments: [],
      audience: "friends",
    },
  ];
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[1]} />
    </PreviewProvider>,
  );
  expect(screen.getByText("A friend's post.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Edit post" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete post" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit profile" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Friends" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Settings" }),
  ).not.toBeInTheDocument();
});
