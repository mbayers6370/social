import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { GalleryPage } from "@/features/gallery/gallery-page";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import type { Bootstrap, Photo } from "@/features/local-preview/model";
import type { PostMedia } from "@/features/feed/schema";
import { notificationFixture } from "./helpers/notification-fixture";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/local-preview/upload", () => ({
  validateLocalPhoto: vi.fn(async () => ({ width: 640, height: 480 })),
}));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const data = notificationFixture().bootstrap;
  const photos: Photo[] = ["Beach", "Coffee"].map((title, index) => ({
    id: `photo-${index}`,
    ownerId: "ines",
    title,
    description: `${title} in the morning`,
    caption: title,
    aspect: "landscape",
    image: {
      src: `/_next/static/media/${title.toLowerCase()}.jpg`,
      width: 640,
      height: 480,
    },
    kind: "fixture",
  }));
  data.photos = photos;
  data.gallery = photos.map((photo) => ({ photoId: photo.id, featured: true }));
  const media: PostMedia = {
    description: photos[0].description,
    caption: photos[0].caption,
    aspect: photos[0].aspect,
    image: photos[0].image,
  };
  data.posts = [
    {
      id: "post-photo",
      author: data.profiles[0].person,
      paragraphs: ["A morning worth keeping."],
      createdAt: data.now,
      expiresAt: "2026-11-26T20:00:00Z",
      likes: 2,
      comments: [],
      audience: "friends",
      media: [media],
    },
  ];
  data.profiles[0].photos = [media];
  data.profiles[0].recent = [
    {
      id: "post-photo",
      date: "27 Oct",
      body: "A morning worth keeping.",
      image: media,
    },
  ];
  data.profiles[1].photos = [media];
  return data;
}
function Harness({ personId }: { personId?: string }) {
  const preview = usePreview();
  const [profile, setProfile] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          void preview
            .upload(
              new File(["local photograph"], "private-filename.png", {
                type: "image/png",
              }),
              "Sunrise",
            )
            .then((photo) => preview.place(photo.id));
        }}
      >
        Add local photograph
      </button>
      <button
        onClick={() =>
          preview.updateDraft({
            body: "An unfinished post",
            photoIds: ["photo-0", "photo-1"],
            replacements: { "photo-0": "photo-1", "photo-1": "photo-0" },
          })
        }
      >
        Prepare draft
      </button>
      <button onClick={() => setProfile(!profile)}>
        {profile ? "Return to gallery" : "Visit profile"}
      </button>
      {profile ? (
        <ProfilePreview profile={preview.state.profiles[0]} />
      ) : (
        <GalleryPage personId={personId} />
      )}
      <output data-testid="state">
        {JSON.stringify({ state: preview.state, draft: preview.draft })}
      </output>
    </>
  );
}
function openGallery(data: Bootstrap = fixture(), personId?: string) {
  return render(
    <PreviewProvider bootstrap={data}>
      <Harness personId={personId} />
    </PreviewProvider>,
  );
}
const snapshot = () => JSON.parse(screen.getByTestId("state").textContent!);
async function openViewer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /View Beach, photograph 1 of/ }),
  );
  return screen.getByRole("dialog", { name: "Photograph" });
}

it("confirms deletion, restores focus on Cancel, then removes the photo from the library, draft and posts across navigation", async () => {
  const user = userEvent.setup();
  openGallery();
  await user.click(screen.getByRole("button", { name: "Prepare draft" }));
  const before = snapshot();
  const viewer = await openViewer(user);
  const remove = within(viewer).getByRole("button", {
    name: "Delete photograph",
  });
  await user.click(remove);
  let confirm = screen.getByRole("alertdialog", { name: "Delete Photograph?" });
  expect(confirm).toHaveTextContent("Post text and conversations stay.");
  await waitFor(() =>
    expect(
      within(confirm).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus(),
  );
  await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(remove).toHaveFocus());
  expect(snapshot()).toEqual(before);
  await user.click(remove);
  confirm = screen.getByRole("alertdialog", { name: "Delete Photograph?" });
  await user.click(
    within(confirm).getByRole("button", { name: "Delete photograph" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Photograph" }),
    ).not.toBeInTheDocument(),
  );
  const next = screen.getByRole("button", {
    name: "View Coffee, photograph 1 of 1",
  });
  await waitFor(() => expect(next).toHaveFocus());
  expect(
    within(screen.getByRole("region", { name: "Your Gallery" })).getByRole(
      "status",
    ),
  ).toHaveTextContent("Photograph deleted");
  const after = snapshot();
  expect(after.state.photos.map((photo: Photo) => photo.id)).toEqual([
    "photo-1",
  ]);
  expect(after.state.posts[0].media).toBeUndefined();
  expect(after.state.posts[0].paragraphs).toEqual(["A morning worth keeping."]);
  expect(after.state.profiles[0].photos).toHaveLength(0);
  expect(after.state.profiles[1].photos).toHaveLength(1);
  expect(after.draft).toMatchObject({
    body: "An unfinished post",
    photoIds: ["photo-1"],
    replacements: {},
  });
  await user.click(screen.getByRole("button", { name: "Visit profile" }));
  expect(screen.getByText("A morning worth keeping.")).toBeVisible();
  expect(
    screen.queryByRole("img", { name: "Beach in the morning" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Return to gallery" }));
  await user.click(screen.getByRole("button", { name: "Add photo" }));
  const picker = screen.getByRole("dialog", { name: "Choose a photograph" });
  expect(
    within(picker).queryByRole("button", { name: "Select Beach" }),
  ).not.toBeInTheDocument();
  expect(
    within(picker).getByRole("button", { name: "Select Coffee" }),
  ).toBeInTheDocument();
});

it("can delete directly from arranging and handles an empty gallery with useful focus and an Add photo action", async () => {
  const user = userEvent.setup();
  const data = fixture();
  data.gallery = data.gallery.slice(0, 1);
  openGallery(data);
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", { name: "Select Beach, photograph 1 of 1" }),
  );
  await user.click(screen.getByRole("button", { name: "Delete photograph" }));
  const confirm = screen.getByRole("alertdialog", {
    name: "Delete Photograph?",
  });
  await user.click(
    within(confirm).getByRole("button", { name: "Delete photograph" }),
  );
  expect(snapshot().state.gallery).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Your Gallery" })).toHaveFocus(),
  );
  expect(screen.getByText("0 of 20 photographs")).toBeVisible();
  expect(
    screen.getByText("Keep a photograph here to begin your gallery."),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Arrange gallery" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add photo" })).toBeEnabled();
});

it("removes the redundant action and discards staged deletion and movement on Cancel", async () => {
  const user = userEvent.setup();
  openGallery();
  await user.click(screen.getByRole("button", { name: "Prepare draft" }));
  const before = snapshot();
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", { name: "Select Beach, photograph 1 of 2" }),
  );
  expect(
    screen.queryByRole("button", { name: "Remove from gallery" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Delete photograph" }));
  const confirm = screen.getByRole("alertdialog", {
    name: "Delete Photograph?",
  });
  await user.click(
    within(confirm).getByRole("button", { name: "Delete photograph" }),
  );
  expect(snapshot()).toEqual(before);
  expect(screen.getByText(/1 photograph will be deleted/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(snapshot()).toEqual(before);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Arrange gallery" }),
    ).toHaveFocus(),
  );
});

it("shows a friend's gallery without owner, arrange or delete controls", async () => {
  const user = userEvent.setup();
  openGallery(fixture(), "theo");
  expect(
    screen.getByRole("heading", { name: /^Theo\s*’s Gallery$/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Add photo" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Arrange gallery" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "View Beach, photograph 1 of 1" }),
  );
  const viewer = screen.getByRole("dialog", { name: "Photograph" });
  expect(
    within(viewer).queryByRole("button", { name: "Delete photograph" }),
  ).not.toBeInTheDocument();
  expect(
    within(viewer).queryByRole("button", { name: "Arrange photograph" }),
  ).not.toBeInTheDocument();
});

it("releases a deleted local image's blob URL once it has no remaining references", async () => {
  const user = userEvent.setup();
  const revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:local-sunrise");
      static revokeObjectURL = revoke;
    },
  );
  const app = openGallery();
  await user.click(
    screen.getByRole("button", { name: "Add local photograph" }),
  );
  await user.click(
    await screen.findByRole("button", { name: /View Sunrise, photograph/ }),
  );
  const viewer = screen.getByRole("dialog", { name: "Photograph" });
  await user.click(
    within(viewer).getByRole("button", { name: "Delete photograph" }),
  );
  const confirm = screen.getByRole("alertdialog", {
    name: "Delete Photograph?",
  });
  await user.click(
    within(confirm).getByRole("button", { name: "Delete photograph" }),
  );
  await waitFor(() =>
    expect(revoke).toHaveBeenCalledWith("blob:local-sunrise"),
  );
  expect(
    snapshot().state.photos.some(
      (photo: Photo) => photo.image.src === "blob:local-sunrise",
    ),
  ).toBe(false);
  app.unmount();
  expect(revoke).toHaveBeenCalledTimes(1);
});

function fullGallery() {
  const data = fixture();
  data.photos = Array.from({ length: 21 }, (_, index) => ({
    ...data.photos[0],
    id: `arrange-${index + 1}`,
    title: `Photo ${index + 1}`,
    description: `Photograph ${index + 1}`,
    image: {
      ...data.photos[0].image,
      src: `/_next/static/media/arrange-${index + 1}.jpg`,
    },
  }));
  data.gallery = data.photos
    .slice(0, 20)
    .map((photo, index) => ({ photoId: photo.id, featured: index < 3 }));
  return data;
}

it("arranges all twenty thumbnails in three featured and seventeen other positions, and commits only with Done", async () => {
  const user = userEvent.setup();
  openGallery(fullGallery());
  const before = snapshot();
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  let editor = screen.getByRole("dialog", { name: "Arrange Gallery" });
  expect(
    within(
      within(editor).getByRole("region", { name: "Featured photographs" }),
    ).getAllByRole("button", { name: /^Select / }),
  ).toHaveLength(3);
  expect(
    within(
      within(editor).getByRole("region", { name: "More photographs" }),
    ).getAllByRole("button", { name: /^Select / }),
  ).toHaveLength(17);
  await user.click(
    within(editor).getByRole("button", {
      name: "Select Photo 2, photograph 2 of 20",
    }),
  );
  await user.click(
    within(editor).getByRole("button", { name: "Move earlier" }),
  );
  expect(snapshot()).toEqual(before);
  await user.click(within(editor).getByRole("button", { name: "Cancel" }));
  expect(snapshot()).toEqual(before);
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  editor = screen.getByRole("dialog", { name: "Arrange Gallery" });
  await user.click(
    within(editor).getByRole("button", {
      name: "Select Photo 2, photograph 2 of 20",
    }),
  );
  await user.click(
    within(editor).getByRole("button", { name: "Move earlier" }),
  );
  await user.click(within(editor).getByRole("button", { name: "Done" }));
  expect(
    snapshot()
      .state.gallery.map((entry: { photoId: string }) => entry.photoId)
      .slice(0, 3),
  ).toEqual(["arrange-2", "arrange-1", "arrange-3"]);
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", { name: "Select Photo 1, photograph 2 of 20" }),
  );
  await user.click(screen.getByRole("button", { name: "Move earlier" }));
  await user.keyboard("{Escape}");
  expect(snapshot().state.gallery[0].photoId).toBe("arrange-2");
});

it("adds a photograph through the sheet with explicit Done and Cancel, without changing the gallery early", async () => {
  const user = userEvent.setup();
  const data = fixture();
  data.gallery = data.gallery.slice(0, 1);
  openGallery(data);
  await user.click(screen.getByRole("button", { name: "Add photo" }));
  let picker = screen.getByRole("dialog", { name: "Choose a photograph" });
  expect(
    within(picker).getByRole("button", { name: "Cancel" }),
  ).toBeInTheDocument();
  await user.click(
    within(picker).getByRole("button", { name: "Select Coffee" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  let editor = await screen.findByRole("dialog", { name: "Add Photograph" });
  expect(snapshot().state.gallery).toHaveLength(1);
  await user.click(within(editor).getByRole("button", { name: "Cancel" }));
  expect(snapshot().state.gallery).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Add photo" }));
  picker = screen.getByRole("dialog", { name: "Choose a photograph" });
  await user.click(
    within(picker).getByRole("button", { name: "Select Coffee" }),
  );
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  editor = await screen.findByRole("dialog", { name: "Add Photograph" });
  await user.click(within(editor).getByRole("button", { name: "Done" }));
  expect(snapshot().state.gallery).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "View Coffee, photograph 2 of 2" }),
  ).toBeInTheDocument();
});

it("requires a deliberate replacement in a full gallery and keeps the replaced photo in the library", async () => {
  const user = userEvent.setup();
  openGallery(fullGallery());
  await user.click(screen.getByRole("button", { name: "Add photo" }));
  await user.click(screen.getByRole("button", { name: "Select Photo 21" }));
  await user.click(
    within(
      screen.getByRole("dialog", { name: "Choose a photograph" }),
    ).getByRole("button", { name: "Use Photograph" }),
  );
  const editor = await screen.findByRole("dialog", { name: "Add Photograph" });
  expect(within(editor).getByRole("button", { name: "Done" })).toBeDisabled();
  await user.click(
    within(editor).getByRole("button", {
      name: "Select Photo 4, photograph 4 of 20",
    }),
  );
  await user.click(
    within(editor).getByRole("button", { name: "Replace selected photograph" }),
  );
  expect(snapshot().state.gallery[3].photoId).toBe("arrange-4");
  await user.click(within(editor).getByRole("button", { name: "Done" }));
  expect(snapshot().state.gallery).toHaveLength(20);
  expect(snapshot().state.gallery[3].photoId).toBe("arrange-21");
  expect(
    snapshot().state.photos.some((photo: Photo) => photo.id === "arrange-4"),
  ).toBe(true);
});
