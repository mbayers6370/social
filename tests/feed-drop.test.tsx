import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedComposer } from "@/features/compose/feed-composer";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import type { Bootstrap } from "@/features/local-preview/model";
import { notificationFixture } from "./helpers/notification-fixture";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
let desktop = true;
const decode = vi.fn();
beforeEach(() => {
  desktop = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: desktop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  decode.mockResolvedValue({ width: 640, height: 480, close: vi.fn() });
  vi.stubGlobal("createImageBitmap", decode);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:local-photo");
      static revokeObjectURL = vi.fn();
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function photograph() {
  const bytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEioAAAAASUVORK5CYII=",
    ),
    (value) => value.charCodeAt(0),
  );
  const file = new File([bytes], "morning.png", { type: "image/png" });
  // JSDOM File lacks arrayBuffer; keep the actual bytes for policy validation.
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer,
  });
  return file;
}
function Witness() {
  const { state, draft } = usePreview();
  return (
    <output data-testid="state">
      {JSON.stringify({ posts: state.posts, photos: state.photos, draft })}
    </output>
  );
}
function openFeed(bootstrap: Bootstrap = notificationFixture().bootstrap) {
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <FeedComposer />
      <Witness />
    </PreviewProvider>,
  );
  return screen.getByRole("group", { name: "Create a post" });
}
function drop(target: HTMLElement, files: File[]) {
  return fireEvent.drop(target, { dataTransfer: { types: ["Files"], files } });
}

it("starts a post with the dropped file, requires its description and attaches it without publishing automatically", async () => {
  const user = userEvent.setup();
  const target = openFeed();
  expect(drop(target, [photograph()])).toBe(false);
  const picker = await screen.findByRole("dialog", {
    name: "Choose a photograph",
  });
  expect(within(picker).getByRole("status")).toHaveTextContent("morning.png");
  expect(
    within(picker).getByRole("img", { name: /Selected photograph/ }),
  ).toHaveAttribute("src", "blob:local-photo");
  await user.click(
    within(picker).getByRole("button", { name: "Use Photograph" }),
  );
  expect(await within(picker).findByRole("alert")).toHaveTextContent(
    "Describe the photograph",
  );
  expect(
    JSON.parse(screen.getByTestId("state").textContent!).photos,
  ).toHaveLength(0);
  await user.type(
    within(picker).getByRole("textbox", {
      name: "Describe the photograph (alt text)",
    }),
    "A quiet morning by the sea",
  );
  await user.click(
    within(picker).getByRole("button", { name: "Use Photograph" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Choose a photograph" }),
    ).not.toBeInTheDocument(),
  );
  const composer = screen.getByRole("dialog", { name: "New Post" });
  expect(
    within(composer).getByRole("img", { name: "A quiet morning by the sea" }),
  ).toBeInTheDocument();
  const state = JSON.parse(screen.getByTestId("state").textContent!);
  expect(state.draft.photoIds).toHaveLength(1);
  expect(state.posts).toHaveLength(0);
  await user.type(
    within(composer).getByRole("textbox", { name: "Your post" }),
    "A morning worth keeping.",
  );
  await user.click(
    within(composer).getByRole("button", { name: "Share with friends" }),
  );
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByTestId("state").textContent!).posts,
    ).toHaveLength(1),
  );
  expect(
    JSON.parse(screen.getByTestId("state").textContent!).posts[0].media[0]
      .description,
  ).toBe("A quiet morning by the sea");
});

it.each(["posts", "images", "gallery"])(
  "rejects a drop when the daily %s allowance is exhausted",
  async (quota) => {
    const data = notificationFixture().bootstrap;
    if (quota === "gallery") {
      data.photos = [0, 1, 2].map((id) => ({
        id: `photo-${id}`,
        ownerId: data.viewerId,
        title: "Morning",
        description: "Morning",
        caption: "Morning",
        aspect: "landscape",
        image: {
          src: `/_next/static/media/photo-${id}.jpg`,
          width: 640,
          height: 480,
        },
        kind: "fixture",
      }));
      data.gallery = data.photos.map((photo) => ({
        photoId: photo.id,
        featured: true,
      }));
      data.galleryAdditions = data.photos.map((photo) => ({
        photoId: photo.id,
        createdAt: data.now,
      }));
    } else {
      data.postingRecords = Array.from(
        { length: quota === "posts" ? 3 : 1 },
        (_, id) => ({
          id: `posted-${id}`,
          authorId: data.viewerId,
          createdAt: data.now,
          hasLink: false,
          imageCount: quota === "images" ? 3 : 0,
        }),
      );
    }
    const target = openFeed(data);
    expect(drop(target, [photograph()])).toBe(false);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      quota === "posts" ? /three-post limit/ : /photographs/,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(decode).not.toHaveBeenCalled();
    expect(
      JSON.parse(screen.getByTestId("state").textContent!).photos,
    ).toHaveLength(quota === "gallery" ? 3 : 0);
  },
);

it("rejects unreadable and multiple files without starting a post", async () => {
  const target = openFeed();
  const invalid = photograph();
  Object.defineProperty(invalid, "name", { value: "not-an-image.svg" });
  drop(target, [invalid]);
  expect(await screen.findByRole("alert")).toHaveTextContent(/isn’t supported/);
  expect(decode).not.toHaveBeenCalled();
  drop(target, [photograph(), photograph()]);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Drop one photograph at a time.",
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("leaves mobile and non-file drags to the browser and keeps the photo button available", () => {
  desktop = false;
  const target = openFeed();
  expect(drop(target, [photograph()])).toBe(true);
  expect(
    fireEvent.drop(target, {
      dataTransfer: { types: ["text/plain"], files: [] },
    }),
  ).toBe(true);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "New photo post" })).toBeEnabled();
});
