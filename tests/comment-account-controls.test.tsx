import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import { ConversationComments } from "@/features/feed/conversation-comments";
import { groupCommentThreads } from "@/features/feed/comment-threads";
import { previewBootstrap } from "./helpers/local-preview-fixture";
import type { FriendPost } from "@/features/local-preview/model";
function Comments() {
  const preview = usePreview();
  const post = preview.state.posts[0];
  return (
    <>
      <button
        onClick={() =>
          preview.dispatchInteraction({
            type: "delete-comment",
            postId: post.id,
            commentId: "parent",
            at: preview.bootstrap.now,
          })
        }
      >
        Try deleting someone else’s comment
      </button>
      <button
        onClick={() =>
          preview.dispatchInteraction({
            type: "comment",
            postId: post.id,
            total: 4,
            comment: {
              id: "new-reply",
              author: post.author,
              body: "My new reply",
              replyTo: "parent",
              createdAt: preview.bootstrap.now,
            },
          })
        }
      >
        Add a new reply
      </button>
      <ConversationComments
        threads={groupCommentThreads([
          ...post.comments,
          ...(preview.interactions[post.id]?.comments ?? []),
        ])}
        visibleCount={5}
        expandedReplies={["parent"]}
        onExpandedChange={vi.fn()}
        onReply={vi.fn()}
        postId={post.id}
        postAuthorId={post.author.id}
        referenceTime={preview.bootstrap.now}
      />
    </>
  );
}
it.each(["ines", "theo"])(
  "edits and deletes an existing account-owned reply on %s’s profile without affecting another author",
  async (owner) => {
    const bootstrap = previewBootstrap();
    const [ines, theo] = bootstrap.profiles.map((profile) => profile.person);
    const post: FriendPost = {
      id: "post-existing",
      author: owner === "ines" ? ines : theo,
      createdAt: bootstrap.now,
      expiresAt: "2026-11-20T00:00:00Z",
      paragraphs: ["An existing post"],
      likes: 0,
      audience: "friends",
      comments: [
        {
          id: "parent",
          author: theo,
          body: "An older question",
          createdAt: bootstrap.now,
        },
        {
          id: "reply",
          author: ines,
          body: "My existing reply",
          replyTo: "parent",
          createdAt: bootstrap.now,
        },
        {
          id: "nested",
          author: theo,
          body: "A reply to my answer",
          replyTo: "reply",
          createdAt: bootstrap.now,
        },
      ],
    };
    bootstrap.posts = [post];
    const user = userEvent.setup();
    render(
      <PreviewProvider bootstrap={bootstrap}>
        <Comments />
      </PreviewProvider>,
    );
    const own = screen
      .getByText("My existing reply")
      .closest(".margin-comment") as HTMLElement;
    const others = screen
      .getByText("An older question")
      .closest(".margin-comment") as HTMLElement;
    expect(
      within(others).queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: "Try deleting someone else’s comment",
      }),
    );
    expect(screen.getByText("An older question")).toBeInTheDocument();
    await user.click(within(own).getByRole("button", { name: "Edit" }));
    await user.clear(
      screen.getByRole("textbox", { name: "Edit your comment" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Edit your comment" }),
      "My revised reply",
    );
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(within(own).getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("My revised reply")).toBeInTheDocument();
    await user.click(within(own).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete comment" }));
    expect(within(own).getByText("Comment deleted.")).toBeInTheDocument();
    expect(screen.getByText("A reply to my answer")).toBeInTheDocument();
    expect(
      within(own).queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a new reply" }));
    const added = screen
      .getByText("My new reply")
      .closest(".margin-comment") as HTMLElement;
    expect(
      within(added).getByRole("link", { name: "Ines Alvarez" }),
    ).toBeInTheDocument();
    expect(
      within(added).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
  },
);
