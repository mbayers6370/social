import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import {
  initialLocalState,
  setProfilePhotograph,
} from "@/features/local-preview/model";
import {
  previewReducer as reducePreview,
  type PreviewAction,
  type PreviewState,
} from "@/features/feed/state";
import {
  createAccountArchive,
  type AccountExportSource,
} from "@/features/settings/account-export";
import { previewBootstrap } from "./helpers/local-preview-fixture";
import { EmptyFeed } from "@/features/feed/empty-feed";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const bootstrap = previewBootstrap();
const now = new Date(bootstrap.now);
const previewReducer = (state: PreviewState, action: PreviewAction) =>
  reducePreview(state, action, bootstrap.viewerId);
it("requires an owned photograph and a replacement at twenty, without discarding the replaced file", () => {
  const state = initialLocalState(bootstrap);
  const template = state.photos[0];
  state.photos = Array.from({ length: 21 }, (_, index) => ({
    ...template,
    id: `photo-${index}`,
    image: { ...template.image, src: `/_next/static/media/photo-${index}.jpg` },
  }));
  state.gallery = state.photos
    .slice(0, 20)
    .map((photo) => ({ photoId: photo.id, featured: false }));
  expect(() =>
    setProfilePhotograph(state, "ines", "photo-20", undefined, now),
  ).toThrow("full");
  const changed = setProfilePhotograph(
    state,
    "ines",
    "photo-20",
    "photo-0",
    now,
  );
  expect(changed.gallery).toHaveLength(20);
  expect(changed.gallery[0].photoId).toBe("photo-20");
  expect(changed.photos).toHaveLength(21);
  expect(changed.profiles[0].person.photo?.src).toContain("photo-20");
  expect(() =>
    setProfilePhotograph(state, "theo", "photo-0", undefined, now),
  ).toThrow("unavailable");
  expect(
    setProfilePhotograph(state, "ines", "photo-0", undefined, now).gallery,
  ).toHaveLength(20);
});
it("edits only owned comments and keeps reply references after a tombstone", () => {
  const mine = {
    id: "own",
    author: bootstrap.profiles[0].person,
    body: "Before",
    createdAt: bootstrap.now,
  };
  let state = previewReducer(
    {},
    { type: "comment", postId: "post-one", comment: mine, total: 1 },
  );
  state = previewReducer(state, {
    type: "comment",
    postId: "post-one",
    comment: {
      ...mine,
      id: "reply",
      author: bootstrap.profiles[1].person,
      body: "A reply",
      replyTo: "own",
    },
    total: 2,
  });
  const denied = previewReducer(state, {
    type: "delete-comment",
    postId: "post-one",
    commentId: "reply",
    at: bootstrap.now,
  });
  expect(denied).toBe(state);
  state = previewReducer(state, {
    type: "edit-comment",
    postId: "post-one",
    commentId: "own",
    body: "After",
    at: bootstrap.now,
  });
  expect(state["post-one"].comments[0]).toMatchObject({
    body: "After",
    editedAt: bootstrap.now,
  });
  state = previewReducer(state, {
    type: "delete-comment",
    postId: "post-one",
    commentId: "own",
    at: bootstrap.now,
  });
  expect(state["post-one"].comments[0]).toMatchObject({
    body: "",
    deletedAt: bootstrap.now,
  });
  expect(state["post-one"].comments[1].replyTo).toBe("own");
  expect(
    previewReducer(state, {
      type: "edit-comment",
      postId: "post-one",
      commentId: "own",
      body: "Restore",
      at: bootstrap.now,
    }),
  ).toBe(state);
});
it("exports chosen categories and the chosen conversation without other profiles or credentials", () => {
  const source: AccountExportSource = {
    state: initialLocalState(bootstrap),
    viewerId: "ines",
    preferences: { readingSize: "standard", motion: "system" },
    interactions: {},
    notifications: {
      readIds: [],
      preferences: { replies: true, friendships: true, likes: false },
    },
    notificationRows: [],
    threads: [
      {
        id: "theo",
        contact: bootstrap.profiles[1].person,
        unread: false,
        messages: [
          {
            id: "one",
            body: "A shared thought 🪴",
            direction: "incoming",
            createdAt: bootstrap.now,
          },
        ],
      },
      {
        id: "other",
        contact: { ...bootstrap.profiles[1].person, id: "other" },
        unread: false,
        messages: [
          {
            id: "two",
            body: "OTHER-CONVERSATION",
            direction: "incoming",
            createdAt: bootstrap.now,
          },
        ],
      },
    ],
    messageAdditions: {},
    messageDrafts: {},
    notebookNotes: [],
    draft: { kind: "post", body: "UNSELECTED-DRAFT", url: "" },
    reports: [],
  };
  Object.assign(source.state.profiles[0], { token: "SECRET-TOKEN" });
  const archive = createAccountArchive(source, ["messages"], "theo", now);
  expect(Object.keys(archive.data)).toEqual(["messages"]);
  expect(JSON.stringify(archive)).toContain("A shared thought 🪴");
  expect(JSON.stringify(archive)).not.toMatch(
    /OTHER-CONVERSATION|UNSELECTED-DRAFT|SECRET-TOKEN/,
  );
  expect(() => createAccountArchive(source, [])).toThrow("Choose");
});
function NewAccount() {
  const preview = usePreview();
  return (
    <>
      <button
        onClick={() =>
          preview.completeOnboarding({
            name: "A new friend",
            username: "newfriend",
            bio: "",
          })
        }
      >
        Start fresh
      </button>
      {preview.freshStart && (
        <>
          <output>
            {preview.threads.flatMap((thread) => thread.messages).length}{" "}
            messages, {preview.allNotifications.length} notifications,{" "}
            {preview.state.gallery.length} photographs
          </output>
          <EmptyFeed />
        </>
      )}
    </>
  );
}
it("starts onboarding with no sample activity and a small-circle invitation", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <NewAccount />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Start fresh" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "0 messages, 0 notifications, 0 photographs",
  );
  expect(
    screen.getByRole("heading", { name: "It starts with your people." }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Invite a friend" }));
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Access requires an invitation code",
  );
});
