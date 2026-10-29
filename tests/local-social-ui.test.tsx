import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider, usePreview } from "@/features/local-preview/provider";
import type { Bootstrap, FriendPost } from "@/features/local-preview/model";
import { ProfileSearch } from "@/features/search/profile-search";
import { PostComposer } from "@/features/compose/post-composer";
import { FeedComposer } from "@/features/compose/feed-composer";
import { FeedExperience } from "@/features/feed/feed-experience";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { OnRepeat } from "@/features/profile/on-repeat";
import { GalleryPage } from "@/features/gallery/gallery-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { MarginShell } from "@/components/layout/margin-shell";
import { MarginNavigation } from "@/components/layout/margin-navigation";
import { Dialog } from "@/components/ui/dialog";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function bootstrap(): Bootstrap {
  const person = {
    id: "ines",
    name: "Ines Alvarez",
    initials: "IA",
    tone: "paper" as const,
  };
  const photos = ["Morning", "Architecture", "Coffee", "Evening"].map(
    (title, index) => ({
      id: `photo-${index}`,
      ownerId: "ines",
      title,
      kind: "fixture" as const,
      description: `${title} photograph`,
      caption: title,
      aspect: "landscape" as const,
      image: {
        src: `/_next/static/media/photo-${index}.jpg`,
        width: 640,
        height: 480,
      },
    }),
  );
  return {
    now: "2026-10-27T20:00:00Z",
    viewerId: "ines",
    photos,
    gallery: photos.map((photo, index) => ({
      photoId: photo.id,
      featured: index < 3,
    })),
    friendships: [{ people: ["ines", "theo"], status: "accepted" }],
    profiles: [
      { person, handle: "ines", bio: "Walking slowly.", recent: [], photos },
      {
        person: {
          ...person,
          id: "theo",
          name: "Theo Marchetti",
          initials: "TM",
        },
        handle: "theo",
        bio: "Reading.",
        recent: [],
        photos: [],
      },
    ],
  };
}
function Witness() {
  const { state } = usePreview();
  return <output data-testid="published">{JSON.stringify(state.posts)}</output>;
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());
function prepareGalleryDrag() {
  class Pointer extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "touch";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  vi.stubGlobal("PointerEvent", Pointer);
  document
    .querySelectorAll<HTMLElement>("[data-gallery-photo]")
    .forEach((cell, index) => {
      const rect =
        index < 3
          ? new DOMRect(index * 110, 100, 100, 100)
          : new DOMRect(0, 220, 150, 150);
      cell.getBoundingClientRect = () => rect;
      const handle = cell.querySelector<HTMLButtonElement>(
        ".margin-gallery-drag",
      )!;
      handle.setPointerCapture = vi.fn();
      handle.releasePointerCapture = vi.fn();
      handle.hasPointerCapture = () => true;
    });
}

it("provides a desktop utility footer and grouped mobile utilities in Settings", () => {
  const { rerender } = render(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginShell profileAvatar={<span>IA</span>}>
        <h1>Feed</h1>
      </MarginShell>
    </PreviewProvider>,
  );
  expect(
    screen.getByRole("navigation", { name: "Footer" }),
  ).toBeInTheDocument();
  expect(screen.getByText("© 2026 margin").closest("footer")).toHaveClass(
    "margin-app-footer-desktop",
  );
  rerender(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginShell profileAvatar={<span>IA</span>}>
        <SettingsPage />
      </MarginShell>
    </PreviewProvider>,
  );
  const navigation = screen.getByRole("navigation", { name: "Help and legal" });
  expect(
    within(navigation).getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("href", "/privacy");
  expect(
    within(navigation).getByRole("link", { name: "Help & safety" }),
  ).toHaveAttribute("href", "/help");
  const copyright = within(navigation.closest("footer")!).getByText(
    "© 2026 margin",
  );
  expect(
    navigation.compareDocumentPosition(copyright) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    within(navigation).queryByRole("link", { name: "Coming soon" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeInTheDocument();
});

it("searches profiles by name and username with keyboard dismissal and focus restoration", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <ProfileSearch />
    </PreviewProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Search profiles" });
  await user.click(trigger);
  const input = screen.getByRole("searchbox", { name: "Name or username" });
  await user.type(input, "@THEO");
  expect(screen.getByRole("link", { name: /Theo Marchetti/ })).toHaveAttribute(
    "href",
    "/?view=profile&person=theo",
  );
  expect(screen.getByRole("status")).toHaveTextContent("1 profile found");
  await user.clear(input);
  await user.type(input, "no match");
  expect(
    screen.getByText("No profiles match. Try another name or username."),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
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
  await user.click(within(picker).getByRole("button", { name: "Use Morning" }));
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
      within(picker).getByRole("button", { name: `Use ${title}` }),
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
  await user.click(
    within(dialog).getByRole("button", { name: "Share with friends" }),
  );
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

it("keeps profile editing visible, moves deletion into the editor and preserves photos", async () => {
  const data = bootstrap();
  const post = {
    id: "post-owned",
    author: data.profiles[0].person,
    createdAt: data.now,
    expiresAt: "2026-11-26T20:00:00Z",
    paragraphs: ["My original thought."],
    likes: 2,
    comments: [],
    audience: "friends" as const,
    media: [data.photos[0]],
  };
  const friend = {
    ...post,
    id: "post-friend",
    author: data.profiles[1].person,
    paragraphs: ["A friend's thought."],
    media: undefined,
  };
  data.posts = [post, friend];
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
      <FeedExperience
        posts={[post, friend]}
        referenceTime={data.now}
        renderedPosts={{}}
      />
    </PreviewProvider>,
  );
  const own = screen.getByRole("article", { name: "Ines Alvarez" });
  expect(screen.getAllByText("My original thought.")).toHaveLength(1);
  expect(screen.getByText("A friend's thought.")).toBeVisible();
  expect(within(own).queryByText("2 likes")).not.toBeInTheDocument();
  const actions = within(own).getByRole("group", { name: "Post actions" });
  const edit = within(actions).getByRole("button", { name: "Edit post" });
  expect(
    within(actions).getByRole("button", {
      name: "Conversation on Ines Alvarez’s post",
    }),
  ).toBeVisible();
  expect(
    within(own).queryByRole("button", { name: "Delete post" }),
  ).not.toBeInTheDocument();
  await user.click(edit);
  const dialog = await screen.findByRole("dialog", { name: "Edit Post" });
  const input = within(dialog).getByRole("textbox", { name: "Your post" });
  expect(input).toHaveValue("My original thought.");
  expect(
    within(dialog).getByRole("button", {
      name: "Remove photograph 1 from draft",
    }),
  ).toBeVisible();
  await user.clear(input);
  await user.type(input, "My revised thought.");
  await user.click(
    within(dialog).getByRole("button", { name: "Save changes" }),
  );
  await waitFor(() => expect(edit).toHaveFocus());
  expect(within(own).getByText("My revised thought.")).toBeVisible();
  expect(screen.queryByText("My original thought.")).not.toBeInTheDocument();
  await user.click(edit);
  const reopened = await screen.findByRole("dialog", { name: "Edit Post" });
  expect(
    within(reopened).getByRole("button", { name: "Delete post" }),
  ).not.toBeVisible();
  await user.click(within(reopened).getByLabelText("Post options"));
  const remove = within(reopened).getByRole("button", { name: "Delete post" });
  await user.click(remove);
  let confirmation = screen.getByRole("alertdialog", {
    name: "Delete this post?",
  });
  expect(
    within(confirmation).getByRole("button", { name: "Keep post" }),
  ).toHaveFocus();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(remove).toHaveFocus());
  expect(own).toBeInTheDocument();
  await user.click(remove);
  confirmation = screen.getByRole("alertdialog", { name: "Delete this post?" });
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete post" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Recent Posts" })).toHaveFocus(),
  );
  expect(screen.queryByText("My revised thought.")).not.toBeInTheDocument();
  expect(screen.getByText("Post deleted.")).toBeVisible();
});

it("never exposes owner controls on somebody else's profile", () => {
  const data = bootstrap();
  data.posts = [
    {
      id: "post-friend",
      author: data.profiles[1].person,
      createdAt: data.now,
      expiresAt: "2026-11-26T20:00:00Z",
      paragraphs: ["A friend's post."],
      likes: 0,
      comments: [],
      audience: "friends",
    },
  ];
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[1]} />
    </PreviewProvider>,
  );
  expect(screen.getByText("A friend's post.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Edit post" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Delete post" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit profile" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Friends" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Settings" }),
  ).not.toBeInTheDocument();
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
  await user.click(within(picker).getByRole("button", { name: "Use Morning" }));
  const composer = screen.getByRole("dialog", { name: "New Post" });
  await user.type(
    within(composer).getByRole("textbox", { name: "Your post" }),
    "One from my gallery.",
  );
  expect(
    within(composer).getByRole("button", { name: "Share with friends" }),
  ).toBeEnabled();
});

it("opens mobile account utilities, keeps the menu through viewport resize, and dismisses safely", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginNavigation profileAvatar={<span>IA</span>} />
    </PreviewProvider>,
  );
  const avatar = screen.getByRole("button", { name: "Profile menu" });
  await user.click(avatar);
  const menu = screen.getByRole("navigation", { name: "Profile menu" });
  await waitFor(() =>
    expect(
      within(menu).getByRole("link", { name: "View profile" }),
    ).toHaveFocus(),
  );
  for (const [name, href] of [
    ["Settings", "/?view=settings"],
    ["Help & safety", "/help"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Copyright", "/copyright"],
  ]) {
    expect(within(menu).getByRole("link", { name })).toHaveAttribute(
      "href",
      href,
    );
  }
  fireEvent(window, new Event("resize"));
  expect(menu).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(avatar).toHaveFocus();
  expect(avatar).toHaveAttribute("aria-expanded", "false");
  await user.click(avatar);
  const privacy = screen.getByRole("link", { name: "Privacy" });
  // JSDOM cannot follow page links; keep the real disclosure click handler.
  privacy.addEventListener("click", (event) => event.preventDefault());
  await user.click(privacy);
  expect(screen.queryByRole("navigation", { name: "Profile menu" })).toBeNull();
});

it("switches exclusively between the desktop avatar menu and notifications, and opens profile editing", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const data = bootstrap();
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <MarginNavigation active="profile" profileAvatar={<span>IA</span>} />
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  const header = screen.getAllByRole("banner")[0];
  const avatar = within(header).getByRole("button", { name: "Profile menu" });
  const bell = within(header).getByRole("button", { name: /Notifications,/ });
  await user.click(avatar);
  let menu = screen.getByRole("navigation", { name: "Profile menu" });
  await waitFor(() =>
    expect(
      within(menu).getByRole("link", { name: "View profile" }),
    ).toHaveFocus(),
  );
  expect(
    within(menu).queryByRole("link", { name: "Feed" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Primary" })).toHaveTextContent(
    "FeedMessages",
  );
  await user.click(bell);
  expect(screen.getByRole("dialog", { name: "Notifications" })).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: "Profile menu" }),
  ).not.toBeInTheDocument();
  await user.click(avatar);
  menu = screen.getByRole("navigation", { name: "Profile menu" });
  expect(
    screen.queryByRole("dialog", { name: "Notifications" }),
  ).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(avatar).toHaveFocus();
  await user.click(avatar);
  menu = screen.getByRole("navigation", { name: "Profile menu" });
  await user.click(within(menu).getByRole("button", { name: "Edit profile" }));
  const dialog = await screen.findByRole("dialog", { name: "Edit profile" });
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toBeVisible();
  expect(push).toHaveBeenCalledWith("/?view=profile", { scroll: false });
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(avatar).toHaveFocus());
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
  await user.click(within(picker).getByRole("button", { name: "Use Morning" }));
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

it("opens photographs without filenames, and arranges three featured slots with explicit controls", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  data.photos[0] = {
    ...data.photos[0],
    kind: "local",
    title: "private-file-name.jpg",
  };
  render(
    <PreviewProvider bootstrap={data}>
      <GalleryPage />
    </PreviewProvider>,
  );
  expect(screen.getByRole("heading", { name: "Your Gallery" })).toBeVisible();
  expect(screen.queryByText(/From a post/)).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", {
      name: "View Morning photograph, photograph 1 of 4",
    }),
  );
  const viewer = screen.getByRole("dialog", { name: "Photograph" });
  expect(viewer).toHaveTextContent("Morning photograph");
  expect(document.body).not.toHaveTextContent("private-file-name.jpg");
  expect(
    within(viewer).getByRole("button", { name: "Previous photograph" }),
  ).toBeDisabled();
  await user.click(
    within(viewer).getByRole("button", { name: "Next photograph" }),
  );
  expect(viewer).toHaveTextContent("Architecture");
  await user.keyboard("{ArrowLeft}");
  expect(viewer).toHaveTextContent("Morning photograph");
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", {
      name: "Select Architecture, photograph 2 of 4",
    }),
  );
  await user.click(screen.getByRole("button", { name: "Move earlier" }));
  expect(
    screen.getByRole("button", {
      name: "Select Architecture, photograph 1 of 4",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await user.click(
    screen.getByRole("button", { name: "Select Evening, photograph 4 of 4" }),
  );
  const feature = screen.getByRole("button", { name: "Feature photograph" });
  expect(feature).toBeDisabled();
  await user.click(feature);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  const handle = screen.getByRole("button", { name: "Move Evening" });
  handle.focus();
  await user.keyboard("{ArrowLeft}");
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: /Select Evening/ }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
});

it("previews a touch exchange without committing, cancels safely, and places instantly with reduced motion", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const handle = screen.getByRole("button", { name: "Move Evening" });
  const original = handle.closest<HTMLElement>("[data-gallery-photo]")!;
  const displaced = screen
    .getByRole("button", { name: "Move Morning" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  const start = () => {
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 300, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 50, clientY: 150 });
  };
  for (const cancel of [
    () => fireEvent.pointerCancel(handle),
    () => fireEvent.lostPointerCapture(handle),
    () => fireEvent.keyDown(window, { key: "Escape" }),
    () => fireEvent(window, new Event("resize")),
  ]) {
    start();
    expect(document.querySelector(".margin-gallery-floating")).toHaveStyle({
      width: "112px",
    });
    expect(document.querySelector(".margin-gallery-floating")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(original).toHaveAttribute("data-lifted", "true");
    expect(original.style.transform).toContain("translate(0px, -120px)");
    expect(displaced.style.transform).toBe(
      "translate(0px, 120px) scale(1.5, 1.5)",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "destination 1 of 4, featured",
    );
    expect(
      within(
        screen.getByRole("region", { name: "More photographs" }),
      ).getByRole("button", { name: /Select Evening/ }),
    ).toBeVisible();
    cancel();
    expect(document.querySelector(".margin-gallery-floating")).toBeNull();
    expect(original.style.transform).toBe("");
  }
  start();
  fireEvent.pointerMove(handle, { clientX: 700, clientY: 450 });
  fireEvent.pointerUp(handle, { clientX: 700, clientY: 450 });
  expect(
    within(screen.getByRole("region", { name: "More photographs" })).getByRole(
      "button",
      { name: /Select Evening/ },
    ),
  ).toBeVisible();
  start();
  const ghost = document.querySelector<HTMLElement>(
    ".margin-gallery-floating",
  )!;
  ghost.animate = vi.fn();
  fireEvent.pointerUp(handle, { clientX: 50, clientY: 150 });
  expect(ghost.animate).not.toHaveBeenCalled();
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: /Select Evening, photograph 1 of 4/ }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Moved Evening to photograph 1 of 4, featured.",
  );
});

it("opens a same-row insertion space and settles the desktop preview before committing", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  const handle = screen.getByRole("button", { name: "Move Morning" });
  fireEvent.pointerDown(handle, {
    clientX: 60,
    clientY: 160,
    pointerType: "mouse",
  });
  fireEvent.pointerMove(handle, {
    clientX: 270,
    clientY: 150,
    pointerType: "mouse",
  });
  const architecture = screen
    .getByRole("button", { name: "Move Architecture" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  expect(architecture.style.transform).toBe(
    "translate(-110px, 0px) scale(1, 1)",
  );
  expect(screen.getByRole("status")).toHaveTextContent("destination 3 of 4");
  const ghost = document.querySelector<HTMLElement>(
    ".margin-gallery-floating",
  )!;
  let settle!: () => void;
  const finished = new Promise<void>((resolve) => {
    settle = resolve;
  });
  ghost.animate = vi.fn(
    () => ({ finished, cancel: vi.fn() }) as unknown as Animation,
  );
  fireEvent.pointerUp(handle, { clientX: 270, clientY: 150 });
  expect(ghost.animate).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ duration: 160 }),
  );
  fireEvent.lostPointerCapture(handle);
  expect(
    screen.getByRole("button", { name: "Select Morning, photograph 1 of 4" }),
  ).toBeVisible();
  await act(async () => {
    settle();
    await finished;
  });
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Select Morning, photograph 3 of 4" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Morning" })).toHaveFocus();
});

it("does not drop a gallery photograph into a slot obscured by the editor header", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <header className="margin-header" style={{ position: "sticky" }} />
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  document.querySelector<HTMLElement>(
    ".margin-gallery-editor-scroll",
  )!.getBoundingClientRect = () => new DOMRect(0, 84, 1280, 500);
  const first = screen
    .getByRole("button", { name: "Move Morning" })
    .closest<HTMLElement>("[data-gallery-photo]")!;
  first.getBoundingClientRect = () => new DOMRect(0, 20, 100, 100);
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 300 });
  fireEvent.pointerMove(handle, { clientX: 50, clientY: 50 });
  fireEvent.pointerUp(handle, { clientX: 50, clientY: 50 });
  expect(
    within(screen.getByRole("region", { name: "More photographs" })).getByRole(
      "button",
      { name: /Select Evening/ },
    ),
  ).toBeVisible();
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
});

it("scrolls near the viewport edge and stops its drag loop when the gallery unmounts", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  prepareGalleryDrag();
  const frames: FrameRequestCallback[] = [];
  const request = vi.fn((callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 300 });
  fireEvent.pointerMove(handle, {
    clientX: 50,
    clientY: window.innerHeight - 10,
  });
  act(() => frames[0](0));
  expect(
    document.querySelector<HTMLElement>(".margin-gallery-editor-scroll")!
      .scrollTop,
  ).toBe(12);
  expect(scroll).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(2);
  unmount();
  expect(cancel).toHaveBeenCalledWith(2);
  expect(document.querySelector(".margin-gallery-floating")).toBeNull();
  act(() => frames[1](16));
  expect(request).toHaveBeenCalledTimes(2);
});

it("drops a photograph into an empty featured slot inside the editor", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <GalleryPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Arrange gallery" }));
  await user.click(
    screen.getByRole("button", { name: "Select Morning, photograph 1 of 4" }),
  );
  await user.click(screen.getByRole("button", { name: "Unfeature" }));
  expect(
    screen.getByRole("button", { name: "Feature photograph" }),
  ).toBeEnabled();
  prepareGalleryDrag();
  document.querySelector<HTMLElement>(
    ".margin-gallery-editor-scroll",
  )!.getBoundingClientRect = () => new DOMRect(0, 0, 600, 500);
  document.querySelector<HTMLElement>(
    "[data-gallery-empty-feature]",
  )!.getBoundingClientRect = () => new DOMRect(400, 100, 100, 100);
  const handle = screen.getByRole("button", { name: "Move Evening" });
  fireEvent.pointerDown(handle, { clientX: 50, clientY: 270 });
  fireEvent.pointerMove(handle, { clientX: 450, clientY: 150 });
  expect(screen.getByRole("status")).toHaveTextContent(
    "Feature Evening on the profile",
  );
  fireEvent.pointerUp(handle, { clientX: 450, clientY: 150 });
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: "Select Evening, photograph 3 of 4" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Move Evening" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Unfeature" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(
    within(
      screen.getByRole("region", { name: "Featured photographs" }),
    ).getByRole("button", { name: "View Evening, photograph 3 of 4" }),
  ).toBeVisible();
});

it("applies reading and motion settings across the local tab and restores them on unmount", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <PreviewProvider bootstrap={bootstrap()}>
      <SettingsPage />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("radio", { name: "Larger" }));
  await user.click(screen.getByRole("radio", { name: "Reduce motion" }));
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "larger",
  );
  await user.click(screen.getByRole("radio", { name: "Larger" }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Extra large" })).toBeChecked();
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "extra-large",
  );
  expect(
    screen.getByRole("group", { name: "Text size preview" }),
  ).toBeVisible();
  await user.click(screen.getByRole("radio", { name: "Standard" }));
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "standard",
  );
  expect(document.documentElement).toHaveAttribute("data-motion", "reduced");
  expect(screen.getByText(/Account controls aren’t available/)).toBeVisible();
  unmount();
  expect(document.documentElement).not.toHaveAttribute("data-motion");
});

it("uses the mobile profile photograph, falling back to a circled icon on load failure", () => {
  const data = bootstrap();
  data.profiles[0].person.photo = data.photos[0].image;
  render(
    <PreviewProvider bootstrap={data}>
      <MarginNavigation profileAvatar={<span>IA</span>} />
    </PreviewProvider>,
  );
  const navigation = screen.getByRole("navigation", {
    name: "Mobile navigation",
  });
  const profile = within(navigation).getByRole("link", { name: "Profile" });
  const image = profile.querySelector("img")!;
  expect(image).toBeInTheDocument();
  const frame = image.parentElement!;
  expect(frame).toHaveStyle({
    borderRadius: "50%",
    overflow: "hidden",
    clipPath: "circle(50%)",
  });
  expect(image).toHaveStyle({
    objectPosition: "center",
    borderRadius: "50%",
    clipPath: "circle(50%)",
  });
  fireEvent.error(image);
  expect(profile.querySelector(".margin-mobile-profile-photo")).toBe(frame);
  expect(frame).toHaveStyle({ borderRadius: "50%", clipPath: "circle(50%)" });
  expect(profile.querySelector("img")).toBeNull();
  expect(
    profile.querySelector(".margin-mobile-profile-photo svg"),
  ).not.toBeNull();
});

it("shows On Repeat above Gallery and lets the owner replace or remove their single song", async () => {
  const consoleError = vi.spyOn(console, "error");
  const user = userEvent.setup();
  const data = bootstrap();
  const catalogue = ["Anchor", "Holocene", "Youth", "Winter"].map(
    (title, index) => ({
      id: `itunes-${123 + index}`,
      title,
      artist: index === 0 ? "Novo Amor" : "Sample artist",
      artwork: data.photos[0].image,
    }),
  );
  data.profiles[0].onRepeat = catalogue.slice(0, 1);
  let saved = [...data.profiles[0].onRepeat!];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost:3000");
    if (init?.method === "POST") {
      const { action, trackId } = JSON.parse(String(init.body));
      saved =
        action === "remove"
          ? saved.filter((track) => track.id !== trackId)
          : [catalogue.find((track) => track.id === trackId)!];
      return Response.json({ tracks: saved });
    }
    const term = url.searchParams.get("q")!.toLowerCase();
    return Response.json({
      tracks: catalogue.filter((track) =>
        `${track.title} ${track.artist}`.toLowerCase().includes(term),
      ),
    });
  });
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  const music = screen.getByRole("region", { name: "On Repeat" });
  const gallery = screen.getByRole("region", { name: "Gallery" });
  expect(
    music.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(within(music).getAllByRole("listitem")).toHaveLength(1);
  const trigger = within(music).getByRole("button", { name: "Find Music" });
  await user.click(trigger);
  const picker = screen.getByRole("dialog", { name: "Find Music" });
  const search = within(picker).getByRole("searchbox", {
    name: "Song or artist",
  });
  await user.type(search, "Winter");
  await user.click(
    await within(picker).findByRole("button", {
      name: "Add Winter by Sample artist",
    }),
  );
  const remove = await within(picker).findByRole("button", {
    name: "Remove Winter from On Repeat",
  });
  expect(
    within(picker).queryByRole("button", {
      name: "Remove Anchor from On Repeat",
    }),
  ).not.toBeInTheDocument();
  await user.click(remove);
  await user.click(
    await within(picker).findByRole("button", {
      name: "Add Winter by Sample artist",
    }),
  );
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(within(music).getByText("Winter")).toBeVisible();
  expect(within(music).queryByText("Anchor")).not.toBeInTheDocument();
  expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
    "Encountered two children with the same key",
  );
});

it("lets a profile visitor open the whole song row by keyboard or pointer and restores focus", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  const tracks = [
    {
      id: "anchor",
      title: "Anchor",
      artist: "Novo Amor",
      artwork: data.photos[0].image,
      appleMusicUrl:
        "https://music.apple.com/us/album/anchor/1672226910?i=1672227410",
      spotifyUrl: "https://open.spotify.com/track/7qH9Z4dJEN0l9bidizW7fq",
    },
  ];
  render(
    <PreviewProvider bootstrap={data}>
      <OnRepeat tracks={tracks} own={false} />
    </PreviewProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Find Music" }),
  ).not.toBeInTheDocument();
  const row = screen.getByRole("button", { name: "Open Anchor by Novo Amor" });
  row.focus();
  await user.keyboard("{Enter}");
  const modal = screen.getByRole("dialog", { name: "Anchor" });
  expect(modal).toHaveAccessibleDescription("Novo Amor");
  for (const [service, href] of [
    ["Apple Music", tracks[0].appleMusicUrl],
    ["Spotify", tracks[0].spotifyUrl],
  ]) {
    const link = within(modal).getByRole("link", {
      name: `Open in ${service} (opens in a new tab)`,
    });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  }
  await user.keyboard("{Escape}");
  expect(row).toHaveFocus();
  await user.click(row.querySelector("img")!);
  expect(screen.getByRole("dialog", { name: "Anchor" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(row).toHaveFocus();
});

it("does not render unsafe song links and keeps the modal dismissible when links are missing", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  render(
    <PreviewProvider bootstrap={data}>
      <OnRepeat
        own={false}
        tracks={[
          {
            id: "unavailable",
            title: "Unavailable",
            artist: "Sample",
            artwork: data.photos[0].image,
            appleMusicUrl: "javascript:alert(1)",
            spotifyUrl:
              "https://open.spotify.com.evil.example/track/7qH9Z4dJEN0l9bidizW7fq",
          },
        ]}
      />
    </PreviewProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Open Unavailable by Sample" }),
  );
  const modal = screen.getByRole("dialog", { name: "Unavailable" });
  expect(within(modal).queryByRole("link")).not.toBeInTheDocument();
  expect(
    within(modal).getByText(
      "Listening links aren’t available for this song yet.",
    ),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Open Unavailable by Sample" }),
  ).toHaveFocus();
});
