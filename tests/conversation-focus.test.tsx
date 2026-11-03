import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  ConversationDialog,
  type ConversationSelection,
} from "@/features/feed/conversation-dialog";
import type { FeedPost } from "@/features/feed/schema";
import { previewPostState } from "@/features/feed/state";

const person = {
  id: "reader",
  name: "Reader",
  initials: "R",
  tone: "paper" as const,
};
const post: FeedPost = {
  id: "post-focus",
  author: person,
  paragraphs: ["A conversation."],
  createdAt: "2026-10-28T17:00:00Z",
  expiresAt: "2026-11-27T17:00:00Z",
  comments: [],
  likes: 0,
};
function Example({ triggerPresent = true, headingPresent = true }) {
  const [selection, setSelection] = useState<ConversationSelection | null>(
    null,
  );
  return (
    <>
      {headingPresent && (
        <h1 id="feed-title" tabIndex={-1}>
          Feed
        </h1>
      )}
      <article id={post.id}>
        {triggerPresent && (
          <button
            onClick={(event) =>
              setSelection({
                post,
                trigger: event.currentTarget,
                scrollY: 0,
                documentTop: 0,
                rect: { top: 0, left: 0, width: 320, height: 200 },
              })
            }
          >
            Open conversation
          </button>
        )}
      </article>
      {selection && (
        <ConversationDialog
          selection={selection}
          viewer={person}
          state={previewPostState({}, post.id)}
          referenceTime={post.createdAt}
          dispatch={() => {}}
          onOpened={() => {}}
          onClosing={() => {}}
          onClosed={() => setSelection(null)}
        />
      )}
    </>
  );
}
function viewport(desktop: boolean) {
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1024px)" && desktop,
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
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([false, true])(
  "restores the original trigger after Escape (desktop=%s)",
  async (desktop) => {
    viewport(desktop);
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open conversation" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
);
it.each([false, true])(
  "uses the page heading if React unmounts the trigger (desktop=%s)",
  async (desktop) => {
    viewport(desktop);
    const user = userEvent.setup();
    const { rerender } = render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open conversation" });
    await user.click(trigger);
    await screen.findByRole("dialog");
    rerender(<Example triggerPresent={false} />);
    expect(trigger.isConnected).toBe(false);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Feed" })).toHaveFocus(),
    );
  },
);
it("closes safely if both the trigger and its fallback heading unmount", async () => {
  viewport(false);
  const user = userEvent.setup();
  const { rerender } = render(<Example />);
  await user.click(screen.getByRole("button", { name: "Open conversation" }));
  await screen.findByRole("dialog");
  rerender(<Example triggerPresent={false} headingPresent={false} />);
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(document.activeElement?.isConnected).toBe(true);
});
