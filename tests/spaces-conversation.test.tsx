import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpacePostCard } from "@/features/spaces/space-post-card";
import { spacesFixture } from "./helpers/spaces-fixture";
import type { SpaceComments } from "@/features/spaces/contracts";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const viewer = { id: "ines", name: "Ines Alvarez" };
const comment = (
  id: string,
  body: string,
  createdAt = "2026-10-27T20:00:00Z",
) => ({ id, body, createdAt, author: viewer });
const page = (
  comments: SpaceComments["comments"],
  nextCursor: string | null = null,
): SpaceComments => ({ comments, nextCursor, readOnly: false, viewer });
const response = (body: object) => new Response(JSON.stringify(body));

it("retains a separate draft and reply target for each post across dismissal, then clears a confirmed submission", async () => {
  const user = userEvent.setup();
  const existing = comment("first", "An existing comment");
  let saved = false;
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      saved = true;
      return response({ id: "saved" });
    }
    return response(
      page(
        saved
          ? [
              existing,
              { ...comment("saved", "My unfinished reply"), replyTo: "first" },
            ]
          : [existing],
      ),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  const post = spacesFixture().posts[0];
  render(
    <>
      <SpacePostCard post={post} viewerId={viewer.id} />
      <SpacePostCard
        post={{ ...post, id: "second-post", body: "Another post" }}
        viewerId={viewer.id}
      />
    </>,
  );
  // Closed cards don't load their conversations.
  expect(fetcher).not.toHaveBeenCalled();
  const triggers = screen.getAllByRole("button", { name: /Conversation on/ });
  await user.click(triggers[0]);
  await user.click(await screen.findByRole("button", { name: /Reply to/ }));
  const input = screen.getByRole("textbox", { name: "Reply to Ines Alvarez" });
  await user.type(input, "My unfinished reply");
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await waitFor(() => expect(triggers[0]).toHaveFocus());
  await user.click(triggers[1]);
  expect(await screen.findByLabelText("Add a comment")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await user.click(triggers[0]);
  expect(
    await screen.findByRole("textbox", { name: "Reply to Ines Alvarez" }),
  ).toHaveValue("My unfinished reply");
  await user.click(
    screen.getByRole("textbox", { name: "Reply to Ines Alvarez" }),
  );
  await user.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByText("Comment saved.");
  expect(fetcher).toHaveBeenCalledWith(
    `/api/posts/${post.id}/comments`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ body: "My unfinished reply", replyTo: "first" }),
    }),
  );
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await user.click(triggers[0]);
  expect(await screen.findByLabelText("Add a comment")).toHaveValue("");
});

it("ignores an older page that arrives after a new comment is confirmed", async () => {
  const user = userEvent.setup();
  const pending = Promise.withResolvers<Response>();
  let posted = false;
  const recent = comment("recent", "Existing recent comment");
  const fresh = comment(
    "fresh",
    "New confirmed comment",
    "2026-10-27T20:01:00Z",
  );
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posted = true;
      return response({ id: "fresh" });
    }
    if (url.includes("?before=")) return pending.promise;
    return response(page(posted ? [recent, fresh] : [recent], "recent"));
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacePostCard post={spacesFixture().posts[0]} viewerId={viewer.id} />,
  );
  await user.click(screen.getByRole("button", { name: /Conversation on/ }));
  await user.click(
    await screen.findByRole("button", { name: "Older comments" }),
  );
  expect(
    screen.getByRole("button", { name: "Loading older comments…" }),
  ).toBeDisabled();
  await user.type(
    screen.getByLabelText("Add a comment"),
    "New confirmed comment",
  );
  await user.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByText("Comment saved.");
  await act(async () =>
    pending.resolve(response(page([comment("old", "Older comment")]))),
  );
  expect(screen.getByText("New confirmed comment")).toBeVisible();
  expect(screen.queryByText("Older comment")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Older comments" })).toBeEnabled();
});

it("keeps already loaded pages and deduplicates overlapping comments when refreshing after a save", async () => {
  const user = userEvent.setup();
  let posted = false;
  const old = comment("old", "Older comment", "2026-10-27T19:00:00Z");
  const recent = comment("recent", "Recent comment");
  const fresh = comment("fresh", "Fresh comment", "2026-10-27T20:01:00Z");
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posted = true;
      return response({ id: "fresh" });
    }
    if (url.includes("?before=")) return response(page([old, recent]));
    return response(page(posted ? [recent, fresh] : [recent], "recent"));
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacePostCard post={spacesFixture().posts[0]} viewerId={viewer.id} />,
  );
  await user.click(screen.getByRole("button", { name: /Conversation on/ }));
  await user.click(
    await screen.findByRole("button", { name: "Older comments" }),
  );
  await screen.findByText("Older comment");
  await user.type(screen.getByLabelText("Add a comment"), "Fresh comment");
  await user.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByText("Comment saved.");
  const comments = within(screen.getByRole("list", { name: "Comments" }));
  expect(comments.getByText("Older comment")).toBeVisible();
  expect(comments.getAllByText("Recent comment")).toHaveLength(1);
  expect(comments.getByText("Fresh comment")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Older comments" }),
  ).not.toBeInTheDocument();
});

it("retains an uncertain submission and its resubmission guard across closing and reopening", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") throw Error("Disconnected");
    return response(page([]));
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacePostCard post={spacesFixture().posts[0]} viewerId={viewer.id} />,
  );
  const trigger = screen.getByRole("button", { name: /Conversation on/ });
  await user.click(trigger);
  await user.type(
    await screen.findByLabelText("Add a comment"),
    "Keep this draft",
  );
  await user.click(screen.getByRole("button", { name: "Post" }));
  await screen.findByRole("button", {
    name: "Reload conversation to check saved comments",
  });
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await user.click(trigger);
  const input = await screen.findByLabelText("Add a comment");
  expect(input).toHaveValue("Keep this draft");
  expect(input).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
});

it("keeps an in-flight submission in its dialog until it is confirmed, without allowing a duplicate", async () => {
  const user = userEvent.setup();
  const pending = Promise.withResolvers<Response>();
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return pending.promise;
    return response(page([]));
  });
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacePostCard post={spacesFixture().posts[0]} viewerId={viewer.id} />,
  );
  await user.click(screen.getByRole("button", { name: /Conversation on/ }));
  await user.type(
    await screen.findByLabelText("Add a comment"),
    "One pending comment",
  );
  await user.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Saving comment…")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByLabelText("Add a comment")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Post" })).toBeDisabled();
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
  await act(async () => pending.resolve(response({ id: "saved" })));
  await screen.findByText("Comment saved.");
  expect(screen.getByLabelText("Add a comment")).toHaveValue("");
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens a notification target after asynchronous loading, expands its reply thread and restores the real post trigger on close", async () => {
  const user = userEvent.setup();
  const pending = Promise.withResolvers<Response>();
  const fetcher = vi.fn(() => pending.promise);
  vi.stubGlobal("fetch", fetcher);
  const post = spacesFixture().posts[0];
  render(
    <SpacePostCard
      post={post}
      conversationTarget={{ postId: post.id, commentId: "target-reply" }}
    />,
  );
  await screen.findByRole("dialog", { name: /Conversation on/ });
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      `/api/posts/${post.id}/comments?comment=target-reply`,
      expect.anything(),
    ),
  );
  await act(async () =>
    pending.resolve(
      response(
        page([
          comment("parent", "Original thought"),
          {
            ...comment("target-reply", "The requested reply"),
            replyTo: "parent",
          },
        ]),
      ),
    ),
  );
  expect(await screen.findByText("The requested reply")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hide replies" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: /Conversation on/ }),
    ).toHaveFocus(),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps an unavailable notification target recoverable without exposing another post's discussion", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
  const post = spacesFixture().posts[0];
  render(
    <SpacePostCard
      post={post}
      conversationTarget={{ postId: post.id, commentId: "deleted-comment" }}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This conversation is unavailable",
  );
  expect(
    screen.queryByText("No comments yet.", { exact: false }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
});
