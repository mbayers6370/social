import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import type { FriendPost } from "@/features/local-preview/model";
import { PostComposer } from "@/features/compose/post-composer";
import { FeedComposer } from "@/features/compose/feed-composer";
import { Dialog } from "@/components/ui/dialog";
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

function Witness() {
  const { state } = usePreview();
  return <output data-testid="published">{JSON.stringify(state.posts)}</output>;
}

it("expands the desktop composer in the feed and preserves text and attachments across viewport changes and cancellation", async () => {
  let desktop = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    matches: desktop,
    addEventListener: (_event: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <FeedComposer />
      <Witness />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  let composer = await screen.findByRole("region", { name: "New Post" });
  expect(screen.getByRole("group", { name: "Create a post" })).toContainElement(
    composer,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const input = within(composer).getByRole("textbox", { name: "Your post" });
  await waitFor(() => expect(input).toHaveFocus());
  await user.type(input, "A thought kept in context.");
  await user.click(
    within(composer).getByRole("button", { name: "Add photograph" }),
  );
  const picker = screen.getByRole("dialog", { name: "Choose a photograph" });
  await user.click(
    within(picker).getByRole("button", { name: "Select Morning" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  expect(
    within(composer).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  act(() => {
    desktop = false;
    listeners.forEach((listener) => listener());
  });
  const mobile = await screen.findByRole("dialog", { name: "New Post" });
  expect(
    within(mobile).getByRole("textbox", { name: "Your post" }),
  ).toHaveValue("A thought kept in context.");
  expect(
    within(mobile).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  act(() => {
    desktop = true;
    listeners.forEach((listener) => listener());
  });
  composer = await screen.findByRole("region", { name: "New Post" });
  expect(
    within(composer).getByRole("textbox", { name: "Your post" }),
  ).toHaveValue("A thought kept in context.");
  await user.click(within(composer).getByRole("button", { name: "Cancel" }));
  const prompt = screen.getByRole("button", { name: "Share a thought…" });
  await waitFor(() => expect(prompt).toHaveFocus());
  await user.click(prompt);
  composer = await screen.findByRole("region", { name: "New Post" });
  expect(
    within(composer).getByRole("textbox", { name: "Your post" }),
  ).toHaveValue("A thought kept in context.");
  expect(
    within(composer).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  expect(JSON.parse(screen.getByTestId("published").textContent!)).toEqual([]);
});

it("opens the feed prompt and photo shortcut, preserves drafts and restores focus", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <FeedComposer />
    </PreviewProvider>,
  );
  const prompt = screen.getByRole("button", { name: "Share a thought…" });
  const photo = screen.getByRole("button", { name: "New photo post" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(prompt);
  const composer = await screen.findByRole("dialog", { name: "New Post" });
  const input = within(composer).getByRole("textbox", { name: "Your post" });
  await waitFor(() => expect(input).toHaveFocus());
  await user.type(input, "A thought to keep.");
  await user.click(within(composer).getByRole("button", { name: "Link" }));
  await user.click(within(composer).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(prompt).toHaveFocus());
  await user.click(photo);
  const picker = await screen.findByRole("dialog", {
    name: "Choose a photograph",
  });
  await user.click(
    within(picker).getByRole("button", { name: "Select Morning" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  const photoComposer = screen.getByRole("dialog", { name: "New Post" });
  expect(
    within(photoComposer).getByRole("textbox", { name: "Your post" }),
  ).toHaveValue("A thought to keep.");
  expect(
    within(photoComposer).getByRole("button", { name: "Post" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    within(photoComposer).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  await user.click(
    within(photoComposer).getByRole("button", { name: "Cancel" }),
  );
  await waitFor(() => expect(photo).toHaveFocus());
});

it.each(["post", "link"] as const)(
  "preserves all three edit photos across mode switches and saves only the active %s mode",
  async (mode) => {
    const data = bootstrap();
    const post: FriendPost = {
      id: "post-mode-switch",
      author: data.profiles[0].person,
      createdAt: data.now,
      expiresAt: "2026-11-26T20:00:00Z",
      paragraphs: ["Three moments."],
      likes: 0,
      comments: [],
      audience: "friends",
      media: data.photos.slice(0, 3),
    };
    data.posts = [post];
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <PreviewProvider bootstrap={data}>
        <Dialog defaultOpen>
          <PostComposer editingPost={post} onComplete={onComplete} />
        </Dialog>
        <Witness />
      </PreviewProvider>,
    );
    const dialog = screen.getByRole("dialog", { name: "Edit Post" });
    const composer = within(dialog);
    expect(
      composer.getAllByRole("button", { name: /^Remove photograph/ }),
    ).toHaveLength(3);
    await user.click(composer.getByRole("button", { name: "Link" }));
    expect(
      composer.queryByRole("button", { name: /^Remove photograph/ }),
    ).not.toBeInTheDocument();
    await user.type(
      composer.getByRole("textbox", { name: "Link" }),
      "https://example.com/walk",
    );
    await user.click(composer.getByRole("button", { name: "Post" }));
    expect(
      composer.getAllByRole("button", { name: /^Remove photograph/ }),
    ).toHaveLength(3);
    await user.click(composer.getByRole("button", { name: "Link" }));
    expect(composer.getByRole("textbox", { name: "Link" })).toHaveValue(
      "https://example.com/walk",
    );
    if (mode === "post")
      await user.click(composer.getByRole("button", { name: "Post" }));
    await user.click(composer.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    await waitFor(() => {
      const [saved]: FriendPost[] = JSON.parse(
        screen.getByTestId("published").textContent!,
      );
      if (mode === "post") {
        expect(saved.media?.map((photo) => photo.image.src)).toEqual(
          data.photos.slice(0, 3).map((photo) => photo.image.src),
        );
        expect(saved.link).toBeUndefined();
      } else {
        expect(saved.link?.url).toBe("https://example.com/walk");
        expect(saved.media).toBeUndefined();
      }
    });
  },
);

it("retains both mode drafts after closing the composer and respects explicit photo removal", async () => {
  const data = bootstrap();
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <FeedComposer />
      <Witness />
    </PreviewProvider>,
  );
  const prompt = screen.getByRole("button", { name: "Share a thought…" });
  await user.click(prompt);
  let dialog = await screen.findByRole("dialog", { name: "New Post" });
  await user.type(
    within(dialog).getByRole("textbox", { name: "Your post" }),
    "Keep these moments.",
  );
  for (const title of ["Morning", "Architecture", "Coffee"]) {
    await user.click(
      within(dialog).getByRole("button", { name: "Add photograph" }),
    );
    const picker = await screen.findByRole("dialog", {
      name: "Choose a photograph",
    });
    await user.click(
      within(picker).getByRole("button", { name: `Select ${title}` }),
    );
    await user.click(
      within(
        screen.getByRole("dialog", { name: "Choose a photograph" }),
      ).getByRole("button", { name: "Use Photograph" }),
    );
  }
  await user.click(within(dialog).getByRole("button", { name: "Link" }));
  await user.type(
    within(dialog).getByRole("textbox", { name: "Link" }),
    "https://example.com/draft",
  );
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await user.click(prompt);
  dialog = await screen.findByRole("dialog", { name: "New Post" });
  expect(within(dialog).getByRole("textbox", { name: "Link" })).toHaveValue(
    "https://example.com/draft",
  );
  await user.click(within(dialog).getByRole("button", { name: "Post" }));
  expect(
    within(dialog).getAllByRole("button", { name: /^Remove photograph/ }),
  ).toHaveLength(3);
  await user.click(
    within(dialog).getByRole("button", {
      name: "Remove photograph 2 from draft",
    }),
  );
  await user.click(within(dialog).getByRole("button", { name: "Link" }));
  await user.click(within(dialog).getByRole("button", { name: "Post" }));
  expect(
    within(dialog).getAllByRole("button", { name: /^Remove photograph/ }),
  ).toHaveLength(2);
  await user.click(within(dialog).getByRole("button", { name: "Publish" }));
  await waitFor(() => {
    const [saved]: FriendPost[] = JSON.parse(
      screen.getByTestId("published").textContent!,
    );
    expect(saved.media?.map((photo) => photo.image.src)).toEqual([
      data.photos[0].image.src,
      data.photos[2].image.src,
    ]);
    expect(saved.link).toBeUndefined();
  });
});

it("keeps the feed photo shortcut within the daily image allowance", async () => {
  const data = bootstrap();
  data.postingRecords = [
    {
      id: "three-images-today",
      authorId: data.viewerId,
      createdAt: data.now,
      hasLink: false,
      imageCount: 3,
    },
  ];
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <FeedComposer />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "New photo post" }));
  const composer = await screen.findByRole("dialog", { name: "New Post" });
  expect(
    screen.queryByRole("dialog", { name: "Choose a photograph" }),
  ).not.toBeInTheDocument();
  expect(
    within(composer).getByRole("button", { name: "Add photograph" }),
  ).toBeDisabled();
  expect(
    within(composer).getByText(/0 photographs remaining today/),
  ).toBeVisible();
});

it("offers today's Gallery photographs in the composer without charging the allowance twice", async () => {
  const data = bootstrap();
  data.galleryAdditions = data.photos
    .slice(0, 3)
    .map((photo) => ({ photoId: photo.id, createdAt: data.now }));
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <FeedComposer />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "New photo post" }));
  const picker = await screen.findByRole("dialog", {
    name: "Choose a photograph",
  });
  expect(
    within(picker).getByLabelText("Photograph from your device"),
  ).toBeDisabled();
  await user.click(
    within(picker).getByRole("button", { name: "Select Morning" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  const composer = screen.getByRole("dialog", { name: "New Post" });
  await user.type(
    within(composer).getByRole("textbox", { name: "Your post" }),
    "One from my gallery.",
  );
  expect(
    within(composer).getByRole("button", { name: "Publish" }),
  ).toBeEnabled();
});

it("validates and shares a text/photo post into local state with a fixed friends audience", async () => {
  vi.stubGlobal("crypto", {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  });
  const user = userEvent.setup();
  const complete = vi.fn();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <Witness />
      <Dialog defaultOpen>
        <PostComposer onComplete={complete} />
      </Dialog>
    </PreviewProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Your post" })).toHaveFocus(),
  );
  await user.click(screen.getByRole("button", { name: "Share with friends" }));
  expect(
    await screen.findByText("Write something before sharing."),
  ).toBeVisible();
  await user.type(
    screen.getByRole("textbox", { name: "Your post" }),
    "A new thought for my friends.",
  );
  await user.click(screen.getByRole("button", { name: "Add photograph" }));
  const picker = screen.getByRole("dialog", { name: "Choose a photograph" });
  await user.click(
    within(picker).getByRole("button", { name: "Select Morning" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  await user.click(screen.getByRole("button", { name: "Share with friends" }));
  await waitFor(() => expect(complete).toHaveBeenCalledOnce());
  const published = JSON.parse(screen.getByTestId("published").textContent!);
  expect(published[0]).toMatchObject({
    paragraphs: ["A new thought for my friends."],
    audience: "friends",
    author: { id: "ines" },
    media: [{ description: "Morning photograph" }],
  });
  expect(push).toHaveBeenCalledWith(
    expect.stringMatching(/^\/\?view=profile#post-local-/),
  );
});

it("shows and enforces the allowance when a URL is pasted into ordinary post text", async () => {
  const data = bootstrap();
  data.postingRecords = [
    {
      id: "earlier",
      authorId: data.viewerId,
      createdAt: data.now,
      hasLink: false,
    },
  ];
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <Dialog defaultOpen>
        <PostComposer onComplete={vi.fn()} />
      </Dialog>
    </PreviewProvider>,
  );
  const input = screen.getByRole("textbox", { name: "Your post" });
  const submit = screen.getByRole("button", { name: "Share with friends" });
  await user.type(input, "A thought with https://example.com");
  expect(submit).toBeDisabled();
  expect(submit).toHaveAccessibleDescription(/must be your only post today/);
  await user.clear(input);
  await user.type(input, "A thought without a link.");
  expect(submit).toBeEnabled();
  expect(submit).toHaveAccessibleDescription(/2 regular posts remaining/);
});
