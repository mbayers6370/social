import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConversationComments } from "@/features/feed/conversation-comments";
import { groupCommentThreads } from "@/features/feed/comment-threads";
import type { FeedComment } from "@/features/feed/schema";

const root: FeedComment = {
  id: "parent",
  author: { id: "samuel", name: "Samuel", initials: "SO", tone: "paper" },
  body: "Where was this?",
  createdAt: "2026-10-27T16:00:00Z",
};
const reply: FeedComment = {
  id: "reply",
  author: { id: "ines", name: "Ines", initials: "IA", tone: "sand" },
  body: "By the headland.",
  createdAt: "2026-10-27T16:01:00Z",
  replyTo: root.id,
};
const nested: FeedComment = {
  ...root,
  id: "nested",
  body: "<script>not executable</script>",
  createdAt: "2026-10-27T16:02:00Z",
  replyTo: reply.id,
};
const threads = groupCommentThreads([root, reply, nested]);
const shared = {
  postId: "post-fog",
  postAuthorId: "ines",
  referenceTime: "2026-10-27T17:00:00Z",
};

it("expands and collapses a reply group by keyboard, retaining reply context and escaped text", async () => {
  const user = userEvent.setup();
  const onReply = vi.fn();
  function Example() {
    const [expanded, setExpanded] = useState(false);
    return (
      <ConversationComments
        {...shared}
        threads={threads}
        visibleCount={5}
        expandedReplies={expanded ? [root.id] : []}
        onExpandedChange={(_, value) => setExpanded(value)}
        onReply={onReply}
      />
    );
  }
  render(<Example />);
  const button = screen.getByRole("button", { name: "Show 2 replies" });
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(
    document.getElementById(button.getAttribute("aria-controls")!),
  ).toHaveAttribute("hidden");
  expect(
    screen.queryByRole("button", { name: "Reply to Ines" }),
  ).not.toBeInTheDocument();
  button.focus();
  await user.keyboard("{Enter}");
  expect(button).toHaveAttribute("aria-expanded", "true");
  const replies = screen.getByRole("list", { name: "Replies to Samuel" });
  expect(within(replies).getAllByRole("listitem")).toHaveLength(2);
  const parentLink = within(replies).getByText("Ines", {
    selector: ".margin-reply-context a",
  });
  expect(parentLink).toHaveAttribute("href", "/?view=profile&person=ines");
  expect(parentLink.parentElement).toHaveTextContent("In reply to Ines");
  expect(
    within(replies).getByText("<script>not executable</script>"),
  ).toBeVisible();
  expect(replies.querySelector("script")).toBeNull();
  await user.click(
    within(replies).getByRole("button", { name: "Reply to Ines" }),
  );
  expect(onReply).toHaveBeenCalledWith(reply);
  button.focus();
  await user.keyboard(" ");
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(button).toHaveFocus();
  expect(
    screen.queryByRole("list", { name: "Replies to Samuel" }),
  ).not.toBeInTheDocument();
});

it("paginates parent comments without using up places on their replies", () => {
  const all = groupCommentThreads([
    root,
    reply,
    nested,
    {
      ...root,
      id: "second",
      body: "Another thought",
      createdAt: "2026-10-27T16:03:00Z",
    },
  ]);
  const props = {
    ...shared,
    threads: all,
    visibleCount: 1,
    expandedReplies: [root.id],
    onExpandedChange: vi.fn(),
    onReply: vi.fn(),
  };
  const { rerender } = render(<ConversationComments {...props} />);
  const comments = screen.getByRole("list", { name: "Comments" });
  expect(comments.children).toHaveLength(1);
  expect(
    screen.getByRole("list", { name: "Replies to Samuel" }).children,
  ).toHaveLength(2);
  expect(screen.queryByText("Another thought")).not.toBeInTheDocument();
  rerender(<ConversationComments {...props} visibleCount={2} />);
  expect(comments.children).toHaveLength(2);
  expect(screen.getByText("Another thought")).toBeVisible();
});
