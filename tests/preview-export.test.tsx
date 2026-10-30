import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPreviewExport } from "@/features/settings/preview-export";
import { PreviewDataControls } from "@/features/settings/preview-data-controls";
import { PreviewProvider } from "@/features/local-preview/provider";
import {
  initialLocalState,
  publishLocalPost,
  type Bootstrap,
} from "@/features/local-preview/model";
const now = new Date("2026-10-27T21:00:00Z");
const bootstrap: Bootstrap = {
  now: now.toISOString(),
  viewerId: "ines",
  profiles: [
    {
      person: { id: "ines", name: "Ines", initials: "IA", tone: "paper" },
      handle: "ines",
      bio: "A short bio",
      photos: [],
      recent: [],
    },
    {
      person: {
        id: "theo",
        name: "Other private identity",
        initials: "TM",
        tone: "paper",
      },
      handle: "theo",
      bio: "other-person-secret",
      photos: [],
      recent: [],
    },
  ],
  photos: [],
  gallery: [],
  friendships: [],
};
afterEach(() => vi.unstubAllGlobals());
it("exports only the viewer's explicit local fields, excluding private identities, files and authentication metadata", () => {
  const state = publishLocalPost(
    initialLocalState(bootstrap),
    "ines",
    { kind: "post", body: "My thought", url: "" },
    "post-one",
    now,
  );
  state.posts.push({
    ...state.posts[0],
    id: "post-other",
    author: bootstrap.profiles[1].person,
    paragraphs: ["another-person-secret"],
  });
  Object.assign(state.profiles[0], {
    token: "auth-secret",
    unknown: "unknown-private-value",
  });
  state.photos.push({
    id: "photo-private",
    ownerId: "theo",
    title: "private-file-name.jpg",
    description: "private-image-secret",
    caption: "",
    kind: "local",
    aspect: "portrait",
    image: { src: "blob:private-image", width: 20, height: 40 },
  });
  state.gallery.push({ photoId: "photo-private", featured: true });
  const data = createPreviewExport(
    state,
    "ines",
    { readingSize: "standard", motion: "system" },
    {},
    now,
  );
  expect(data.posts).toHaveLength(1);
  expect(data.profile?.name).toBe("Ines");
  expect(data.gallery).toEqual([]);
  expect(data.scope).toBe("local-preview");
  expect(JSON.stringify(data)).not.toMatch(
    /other-person-secret|another-person-secret|Other private identity|auth-secret|unknown-private-value|private-file-name|private-image-secret|blob:/,
  );
});
it("downloads JSON on explicit activation and leaves real account deletion unavailable", async () => {
  const create = vi.fn(() => "blob:download");
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    },
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  const user = userEvent.setup();
  const { unmount } = render(
    <PreviewProvider bootstrap={bootstrap}>
      <PreviewDataControls />
    </PreviewProvider>,
  );
  await user.click(
    screen.getByText("Account removal", { selector: "summary span" }),
  );
  expect(screen.getByRole("button", { name: /Delete account/ })).toBeDisabled();
  expect(create).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Download your data" }));
  expect(create).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  await user.click(screen.getByRole("checkbox", { name: /Profile & music/ }));
  await user.click(screen.getByRole("radio", { name: "JSON records only" }));
  await user.click(screen.getByRole("button", { name: "Download" }));
  expect(create).toHaveBeenCalledOnce();
  expect((create.mock.calls as unknown as [[Blob]])[0][0].type).toBe(
    "application/json",
  );
  expect(click).toHaveBeenCalledOnce();
  unmount();
  expect(revoke).toHaveBeenCalledWith("blob:download");
});
it("enforces the allowance at the local mutation boundary even if a caller bypasses the composer", () => {
  let state = initialLocalState(bootstrap);
  const input = { kind: "post", body: "A thought", url: "" };
  for (let index = 0; index < 3; index++)
    state = publishLocalPost(state, "ines", input, `post-${index}`, now);
  expect(() =>
    publishLocalPost(state, "ines", input, "post-four", now),
  ).toThrow("three-post limit");
  expect(state.posts).toHaveLength(3);
  const linked = publishLocalPost(
    initialLocalState(bootstrap),
    "ines",
    { ...input, body: "Read https://example.com" },
    "post-link",
    now,
  );
  expect(() =>
    publishLocalPost(linked, "ines", input, "post-two", now),
  ).toThrow("only post for today");
});
