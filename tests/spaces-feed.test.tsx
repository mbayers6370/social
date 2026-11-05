import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import {
  SpacesPreviewProvider,
  useSpacesPreview,
} from "@/features/spaces/preview-provider";
import { visibleSpacePosts } from "@/features/spaces/preview-selectors";
import { FeedExperience } from "@/features/feed/feed-experience";
import { SpaceTimeline } from "@/features/spaces/space-timeline";
import { previewBootstrap } from "./helpers/local-preview-fixture";
import { spacesFixture } from "./helpers/spaces-fixture";
import type { FeedPost } from "@/features/feed/schema";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
afterEach(() => vi.unstubAllGlobals());
function Controls() {
  const session = useSpacesPreview();
  const personal = usePreview();
  return (
    <>
      <button
        onClick={() =>
          session.client.request("/api/spaces/sample-room/members", {
            method: "PATCH",
            body: JSON.stringify({
              action: "preferences",
              includeInFeed: !session.data.spaces[0].includeInFeed,
            }),
          })
        }
      >
        Toggle Space feed
      </button>
      <button onClick={() => personal.changeFriend("theo", "block")}>
        Block Theo
      </button>
    </>
  );
}
it("mixes opted-in canonical Space posts with personal posts in the ordinary preview Feed and keeps opt-out personal", async () => {
  const user = userEvent.setup();
  const bootstrap = previewBootstrap();
  const post: FeedPost = {
    id: "post-personal",
    author: bootstrap.profiles[1].person,
    paragraphs: ["Personal thought"],
    createdAt: "2026-10-27T18:00:00Z",
    expiresAt: "2026-11-26T18:00:00Z",
    likes: 0,
    comments: [],
  };
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <SpacesPreviewProvider bootstrap={spacesFixture()}>
        <Controls />
        <FeedExperience
          posts={[post]}
          referenceTime={bootstrap.now}
          renderedPosts={{}}
        />
      </SpacesPreviewProvider>
    </PreviewProvider>,
  );
  expect(screen.getAllByRole("article")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Toggle Space feed" }));
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  const [space, personal] = screen.getAllByRole("article");
  expect(space).toHaveAttribute("id", "space-canonical");
  expect(
    within(space).getByRole("link", { name: "Space: Japan 2027" }),
  ).toHaveAttribute("href", "/preview/spaces?space=sample-room");
  expect(
    within(personal).queryByRole("link", { name: /Space:/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Toggle Space feed" }));
  expect(screen.queryByText("Shared suggestion")).not.toBeInTheDocument();
  expect(screen.getByText("Personal thought")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Toggle Space feed" }));
  await user.click(screen.getByRole("button", { name: "Block Theo" }));
  expect(screen.queryByText("Shared suggestion")).not.toBeInTheDocument();
});
it("hides opted-in Event posts from the preview feed while preserving their data", () => {
  const data = spacesFixture();
  data.spaces[0].kind = "EVENT";
  data.spaces[0].includeInFeed = true;
  function Feed() {
    const preview = useSpacesPreview();
    return (
      <>
        <span>{preview.feedPosts.length} visible posts</span>
        <span>{preview.data.posts.length} stored posts</span>
      </>
    );
  }
  render(
    <SpacesPreviewProvider bootstrap={data}>
      <Feed />
    </SpacesPreviewProvider>,
  );
  expect(screen.getByText("0 visible posts")).toBeInTheDocument();
  expect(screen.getByText("1 stored posts")).toBeInTheDocument();
});
it("keeps the live timeline's authenticated transport even when the development data provider is present", async () => {
  const user = userEvent.setup();
  const data = spacesFixture();
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          comments: [],
          nextCursor: null,
          readOnly: false,
          viewer: { id: "ines", name: "Ines Alvarez" },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  const post = {
    ...data.posts[0],
    photos: [
      {
        id: "real-photo",
        width: 4,
        height: 3,
        description: "Protected photograph",
      },
    ],
  };
  render(
    <SpacesPreviewProvider bootstrap={data}>
      <SpaceTimeline
        data={{
          posts: [
            post,
            { ...post, id: "personal-live", space: null, photos: [] },
          ],
          nextCursor: null,
        }}
        href="/app/feed"
        viewerId="ines"
      />
    </SpacesPreviewProvider>,
  );
  expect(
    screen.getByRole("img", { name: "Protected photograph" }),
  ).toHaveAttribute("src", "/api/photos/real-photo");
  const [space, personal] = screen.getAllByRole("article");
  expect(
    within(space).getByRole("link", { name: "Space: Japan 2027" }),
  ).toHaveAttribute("href", "/app/spaces/sample-room");
  expect(
    within(personal).queryByRole("link", { name: /Space:/ }),
  ).not.toBeInTheDocument();
  await user.click(
    within(space).getByRole("button", { name: /Conversation on/ }),
  );
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/posts/space-canonical/comments",
      expect.any(Object),
    ),
  );
});
it("Space feed inclusion needs current membership and unexpired content, while personal blocks apply independently of friendship", () => {
  const data = spacesFixture();
  data.spaces[0].includeInFeed = true;
  expect(visibleSpacePosts(data, [], data.now).map((p) => p.id)).toEqual([
    "space-canonical",
  ]);
  expect(
    visibleSpacePosts(
      data,
      [{ people: ["ines", "theo"], status: "blocked", blockedBy: "theo" }],
      data.now,
    ),
  ).toEqual([]);
  expect(
    visibleSpacePosts(data, [], Date.parse(data.posts[0].expiresAt)),
  ).toEqual([]);
  data.spaces[0].members = data.spaces[0].members.filter(
    (m) => m.userId !== data.viewer.id,
  );
  expect(visibleSpacePosts(data, [], data.now)).toEqual([]);
});

it("keeps your own Space posts inside the Space while excluding them from your main feed", () => {
  const data = spacesFixture();
  data.spaces[0].includeInFeed = true;
  data.posts.push({
    ...data.posts[0],
    id: "my-space-post",
    author: data.viewer,
  });
  expect(visibleSpacePosts(data, [], data.now).map((post) => post.id)).toEqual([
    "space-canonical",
  ]);
  expect(
    visibleSpacePosts(data, [], data.now, data.spaces[0].id).map(
      (post) => post.id,
    ),
  ).toEqual(["space-canonical", "my-space-post"]);
});
