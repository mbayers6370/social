// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevelopmentFeed } from "@/server/fixtures/feed";
import {
  calendarDayLabel,
  chronologicalPosts,
  dayKey,
  postTime,
} from "@/features/feed/format";
import { commentInputSchema, postSchema } from "@/features/feed/schema";
import { previewPostState, previewReducer } from "@/features/feed/state";
import { groupCommentThreads } from "@/features/feed/comment-threads";
import type { FeedComment } from "@/features/feed/schema";

afterEach(() => vi.unstubAllEnvs());
function fixture() {
  vi.stubEnv("NODE_ENV", "development");
  return getDevelopmentFeed();
}

describe("chronological feed and isolated fixtures", () => {
  it("sorts newest first without mutating its input", () => {
    const { posts } = fixture();
    const reversed = [...posts].reverse();
    expect(chronologicalPosts(reversed).map((post) => post.id)).toEqual(
      posts.map((post) => post.id),
    );
    expect(reversed[0].id).toBe(posts.at(-1)!.id);
  });
  it("uses a consistent timezone for the day and time across server and browser", () => {
    expect(dayKey("2026-10-27T04:30:00Z")).toBe("2026-10-26");
    expect(calendarDayLabel("2026-10-27T04:30:00Z")).toBe("Monday, 26 October");
    expect(postTime("2026-10-27T16:42:00Z")).toBe("9:42 am");
  });
  it("refuses to serve development fixtures in production or test runtimes", () => {
    for (const environment of ["production", "test"] as const) {
      vi.stubEnv("NODE_ENV", environment);
      expect(getDevelopmentFeed).toThrow(
        "Development fixtures are unavailable",
      );
    }
  });
  it("validates fixture DTOs and rejects unsafe link protocols", () => {
    const { posts } = fixture();
    expect(posts.every((post) => postSchema.safeParse(post).success)).toBe(
      true,
    );
    expect(
      postSchema.safeParse({
        ...posts[0],
        link: { title: "Unsafe", url: "javascript:alert(1)" },
      }).success,
    ).toBe(false);
  });
  it("bounds comment input and rejects unexpected fields", () => {
    expect(commentInputSchema.parse({ body: "  A thought.  " }).body).toBe(
      "A thought.",
    );
    for (const input of [
      { body: " " },
      { body: "x".repeat(2001) },
      { body: "Fine", ownerId: "other" },
    ])
      expect(commentInputSchema.safeParse(input).success).toBe(false);
  });
});

describe("local preview state", () => {
  it("keeps expanded reply groups isolated per post and preserves them through other actions", () => {
    let state = previewReducer(
      {},
      {
        type: "replies",
        postId: "post-fog",
        commentId: "fog-3",
        expanded: true,
      },
    );
    const expanded = state;
    state = previewReducer(state, {
      type: "replies",
      postId: "post-fog",
      commentId: "fog-3",
      expanded: true,
    });
    state = previewReducer(state, { type: "like", postId: "post-fog" });
    expect(previewPostState(state, "post-fog").expandedReplies).toEqual([
      "fog-3",
    ]);
    expect(previewPostState(state, "post-book").expandedReplies).toEqual([]);
    state = previewReducer(state, {
      type: "replies",
      postId: "post-fog",
      commentId: "fog-3",
      expanded: false,
    });
    expect(previewPostState(state, "post-fog").expandedReplies).toEqual([]);
    expect(previewPostState(expanded, "post-fog").expandedReplies).toEqual([
      "fog-3",
    ]);
  });
  it("toggles one post's like without changing any other post", () => {
    const first = previewReducer({}, { type: "like", postId: "post-fog" });
    expect(previewPostState(first, "post-fog").liked).toBe(true);
    expect(previewPostState(first, "post-book").liked).toBe(false);
    const second = previewReducer(first, { type: "like", postId: "post-fog" });
    expect(previewPostState(second, "post-fog").liked).toBe(false);
    expect(previewPostState(first, "post-fog").liked).toBe(true);
  });
  it("keeps drafts and comment pagination per post", () => {
    let state = previewReducer(
      {},
      { type: "draft", postId: "post-book", body: "An unfinished thought" },
    );
    state = previewReducer(state, { type: "more", postId: "post-fog" });
    expect(previewPostState(state, "post-book").draft).toBe(
      "An unfinished thought",
    );
    expect(previewPostState(state, "post-book").visibleCount).toBe(5);
    expect(previewPostState(state, "post-fog").draft).toBe("");
    expect(previewPostState(state, "post-fog").visibleCount).toBe(10);
  });
  it("adds a local reply without mutating the fixture and clears the draft", () => {
    const { posts } = fixture();
    const post = posts[0];
    const comment = {
      id: "local-comment",
      author: post.author,
      body: "A local reply",
      createdAt: "2026-10-27T18:00:00Z",
      replyTo: "fog-1",
    };
    let state = previewReducer(
      {},
      {
        type: "reply",
        postId: post.id,
        replyTo: { id: "fog-1", name: "Theo Marchetti" },
      },
    );
    state = previewReducer(state, {
      type: "comment",
      postId: post.id,
      comment,
      total: 11,
    });
    expect(previewPostState(state, post.id)).toMatchObject({
      comments: [comment],
      draft: "",
      replyTo: null,
      visibleCount: 11,
    });
    expect(post.comments).toHaveLength(10);
  });
});

describe("comment threading", () => {
  const comment = (
    id: string,
    minute: number,
    replyTo?: string,
  ): FeedComment => ({
    id,
    author: { id: "person", name: "A person", initials: "AP", tone: "paper" },
    body: id,
    createdAt: new Date(Date.UTC(2026, 9, 27, 16, minute)).toISOString(),
    ...(replyTo ? { replyTo } : {}),
  });
  it("keeps descendants together and sorts parents and replies chronologically without mutating inputs", () => {
    const comments = [
      comment("nested", 3, "reply"),
      comment("other", 4),
      comment("reply", 2, "root"),
      comment("root", 1),
    ];
    const threads = groupCommentThreads(comments);
    expect(threads.map((thread) => thread.comment.id)).toEqual([
      "root",
      "other",
    ]);
    expect(threads[0].replies.map((reply) => reply.id)).toEqual([
      "reply",
      "nested",
    ]);
    expect(comments.map((item) => item.id)).toEqual([
      "nested",
      "other",
      "reply",
      "root",
    ]);
    expect(threads[0].replies[1].replyTo).toBe("reply");
  });
  it("retains orphaned and cyclic comments instead of losing them or looping", () => {
    const comments = [
      comment("orphan", 1, "missing"),
      comment("child", 2, "orphan"),
      comment("self", 3, "self"),
      comment("a", 4, "b"),
      comment("b", 5, "a"),
    ];
    const threads = groupCommentThreads(comments);
    expect(
      threads
        .flatMap(({ comment, replies }) => [
          comment.id,
          ...replies.map((reply) => reply.id),
        ])
        .sort(),
    ).toEqual(comments.map((item) => item.id).sort());
    expect(
      threads.find((thread) => thread.comment.id === "orphan")!.replies[0].id,
    ).toBe("child");
  });
});
