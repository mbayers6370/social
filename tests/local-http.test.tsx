import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createLocalId } from "@/lib/local-id";
import { ConversationDialog } from "@/features/feed/conversation-dialog";
import { previewPostState } from "@/features/feed/state";
import { MessagesPreview } from "@/features/messages/messages-preview";
import { PreviewProvider } from "@/features/local-preview/provider";
import { notificationFixture } from "./helpers/notification-fixture";
import type { FeedPost } from "@/features/feed/schema";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
const getRandomValues = globalThis.crypto.getRandomValues.bind(
  globalThis.crypto,
);
beforeEach(() => {
  // HTTP LAN browsers expose getRandomValues but omit secure-context randomUUID.
  vi.stubGlobal("crypto", { getRandomValues });
  vi.stubGlobal("isSecureContext", false);
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
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

const post: FeedPost = {
  id: "post-local-http",
  author: { id: "ines", name: "Ines", initials: "IA", tone: "paper" },
  paragraphs: ["A quiet morning."],
  createdAt: "2026-10-27T16:00:00Z",
  expiresAt: "2026-11-03T16:00:00Z",
  likes: 0,
  comments: [],
};

it("generates full-length opaque IDs using secure bytes without randomUUID", () => {
  const fill = vi.fn((bytes: Uint8Array) => {
    bytes.set(Array.from({ length: bytes.length }, (_, index) => index));
    return bytes;
  });
  vi.stubGlobal("crypto", { getRandomValues: fill });
  expect(createLocalId()).toBe("000102030405060708090a0b0c0d0e0f");
  expect(fill).toHaveBeenCalledOnce();
  expect(fill.mock.calls[0][0]).toHaveLength(16);
});
it("produces independent local record IDs when the secure-context UUID API is missing", () => {
  expect(globalThis.crypto.randomUUID).toBeUndefined();
  const ids = Array.from({ length: 100 }, () => createLocalId());
  expect(new Set(ids).size).toBe(100);
  for (const id of ids) expect(id).toMatch(/^[a-f0-9]{32}$/);
});
it("opens a mobile conversation, records its history marker, posts a comment and closes without randomUUID", async () => {
  const user = userEvent.setup();

  const dispatch = vi.fn();
  const onClosed = vi.fn();
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  render(
    <ConversationDialog
      viewer={post.author}
      selection={{
        post,
        trigger: document.createElement("button"),
        scrollY: 0,
        documentTop: 0,
        rect: { left: 24, top: 100, width: 342, height: 400 },
      }}
      state={previewPostState({}, post.id)}
      referenceTime="2026-10-27T17:00:00Z"
      dispatch={dispatch}
      onOpened={vi.fn()}
      onClosing={vi.fn()}
      onClosed={onClosed}
    />,
  );
  expect(
    await screen.findByRole("dialog", { name: "Conversation on Ines’s post" }),
  ).toBeVisible();
  expect(window.history.state.marginConversation).toMatch(/^[a-f0-9]{32}$/);
  expect(window.location.hash).toBe("#conversation-post-local-http");
  await user.type(
    screen.getByRole("textbox", { name: "Add a comment" }),
    "A thought from my phone.",
  );
  await user.click(screen.getByRole("button", { name: "Post" }));
  await waitFor(() =>
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "comment",
        comment: expect.objectContaining({
          id: expect.stringMatching(/^local-[a-f0-9]{32}$/),
          body: "A thought from my phone.",
        }),
      }),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Back to post" }));
  expect(back).toHaveBeenCalledOnce();
  expect(onClosed).toHaveBeenCalledOnce();
});
it("adds a local message when randomUUID is unavailable", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <MessagesPreview
        threads={[
          {
            id: "theo",
            contact: { id: "theo", name: "Theo", initials: "TM", tone: "sage" },
            unread: false,
            messages: [
              {
                id: "first",
                body: "Good morning",
                direction: "incoming",
                createdAt: "2026-10-27T16:00:00Z",
              },
            ],
          },
        ]}
      />
    </PreviewProvider>,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Message to Theo" }),
    "Hello from my phone.",
  );
  await user.click(
    screen.getByRole("button", { name: "Add message to local preview" }),
  );
  expect(
    await within(
      screen.getByRole("region", { name: "Message history" }),
    ).findByText("Hello from my phone."),
  ).toBeVisible();
});

it("keeps a desktop conversation's post below the sticky header when aligning the pair", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1024px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const original = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("margin-header"))
        return new DOMRect(0, 0, 1280, 84);
      if (this.id === post.id) return new DOMRect(320, 16, 600, 400);
      return original.call(this);
    },
  );
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  render(
    <>
      <header className="margin-header" />
      <article id={post.id}>The original post</article>
      <ConversationDialog
        viewer={post.author}
        selection={{
          post,
          trigger: document.createElement("button"),
          scrollY: 0,
          documentTop: 0,
          rect: { left: 320, top: 16, width: 600, height: 400 },
        }}
        state={previewPostState({}, post.id)}
        referenceTime="2026-10-27T17:00:00Z"
        dispatch={vi.fn()}
        onOpened={vi.fn()}
        onClosing={vi.fn()}
        onClosed={vi.fn()}
      />
    </>,
  );
  await screen.findByRole("dialog", { name: "Conversation on Ines’s post" });
  expect(scroll).toHaveBeenCalledWith({ top: -100, behavior: "instant" });
});
