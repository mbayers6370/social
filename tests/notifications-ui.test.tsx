import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider } from "@/features/local-preview/provider";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { NotificationPreferences } from "@/features/notifications/notification-preferences";
import { SettingsPage } from "@/features/settings/settings-page";
import { FeedExperience } from "@/features/feed/feed-experience";
import {
  notificationFixture,
  notificationNow,
} from "./helpers/notification-fixture";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
function viewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query === "(min-width: 1024px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
beforeEach(() => {
  viewport(true);
  window.history.replaceState({}, "", "/");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
});
afterEach(() => {
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});
function setup(preferences = false) {
  const { bootstrap } = notificationFixture();
  return render(
    <PreviewProvider bootstrap={bootstrap}>
      <NotificationCenter />
      {preferences && <NotificationPreferences />}
    </PreviewProvider>,
  );
}
it.each(["profile", "feed"] as const)(
  "keeps desktop %s conversations in their intended presentation and restores focus",
  async (surface) => {
    const { bootstrap, post } = notificationFixture();
    const friendPost = {
      ...post,
      id: "post-friend-presentation",
      author: bootstrap.profiles[1].person,
    };
    bootstrap.posts = [post, friendPost].map((item) => ({
      ...item,
      audience: "friends",
    }));
    const profile = surface === "profile";
    const current = profile ? post : friendPost;
    const user = userEvent.setup();
    render(
      <PreviewProvider bootstrap={bootstrap}>
        <FeedExperience
          posts={[]}
          referenceTime={bootstrap.now}
          renderedPosts={{}}
          profileId={profile ? bootstrap.viewerId : undefined}
        />
      </PreviewProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: `Conversation on ${current.author.name}’s post`,
    });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", {
      name: `Conversation on ${current.author.name}’s post`,
    });
    expect(dialog).toHaveAttribute(
      "data-layout",
      profile ? "inline-flip" : "panel",
    );
    expect(dialog).not.toHaveAttribute("aria-modal", "true");
    if (profile) {
      expect(
        document
          .getElementById(post.id)
          ?.closest<HTMLElement>(".margin-post-slot")?.style.height,
      ).toBe("var(--margin-conversation-height)");
    }
    const back = within(dialog).getByRole("button", {
      name: profile ? "Back to post" : "Close conversation",
    });
    expect(back).toHaveFocus();
    await user.click(back);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
);

it("animates the desktop profile row's height with its flip and reverses both on Back", async () => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  type Motion = {
    currentTime: number;
    playbackRate: number;
    onfinish: (() => void) | null;
    reverse: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  const motions: {
    node: HTMLElement;
    keyframes: Keyframe[];
    motion: Motion;
  }[] = [];
  HTMLElement.prototype.animate = function (keyframes) {
    const motion: Motion = {
      currentTime: 0,
      playbackRate: 1,
      onfinish: null,
      reverse: vi.fn(() => {
        motion.playbackRate = -1;
      }),
      cancel: vi.fn(),
    };
    motions.push({ node: this, keyframes: keyframes as Keyframe[], motion });
    return motion as unknown as Animation;
  };
  try {
    const { bootstrap, post } = notificationFixture();
    bootstrap.posts = [{ ...post, audience: "friends" }];
    const user = userEvent.setup();
    render(
      <PreviewProvider bootstrap={bootstrap}>
        <FeedExperience
          posts={[]}
          referenceTime={bootstrap.now}
          renderedPosts={{}}
          profileId={bootstrap.viewerId}
        />
      </PreviewProvider>,
    );
    const trigger = screen.getByRole("button", {
      name: "Conversation on Ines’s post",
    });
    await user.click(trigger);
    const frame = motions.find(
      ({ node }) => node.dataset.layout === "inline-flip",
    )!;
    const slot = motions.find(({ node }) =>
      node.classList.contains("margin-post-slot"),
    )!;
    expect(frame).toBeDefined();
    expect(slot).toBeDefined();
    expect(frame.keyframes.at(-1)).toMatchObject({
      width: "var(--reading-width)",
      height: "var(--margin-conversation-height)",
      transform: "perspective(1200px) rotateY(-180deg)",
    });
    expect(
      frame.keyframes.some(
        ({ width, height }) => width === "100%" || height === "100dvh",
      ),
    ).toBe(false);
    expect(slot.keyframes.at(-1)?.height).toBe(
      "var(--margin-conversation-height)",
    );
    act(() => {
      frame.motion.currentTime = 520;
      slot.motion.currentTime = 520;
      frame.motion.onfinish?.();
    });
    const dialog = screen.getByRole("dialog", {
      name: "Conversation on Ines’s post",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Back to post" }),
    );
    expect(frame.motion.reverse).toHaveBeenCalledOnce();
    expect(slot.motion.reverse).toHaveBeenCalledOnce();
    act(() => frame.motion.onfinish?.());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(slot.node.style.height).toBe("");
  } finally {
    if (original)
      Object.defineProperty(HTMLElement.prototype, "animate", original);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});

it("opens a nonmodal desktop panel without changing history, preserves unread items, and restores keyboard focus", async () => {
  const user = userEvent.setup();
  setup();
  const trigger = screen.getByRole("button", {
    name: "Notifications, 2 unread",
  });
  const length = window.history.length;
  trigger.focus();
  await user.keyboard("{Enter}");
  const panel = screen.getByRole("dialog", { name: "Notifications" });
  expect(panel).not.toHaveAttribute("aria-modal", "true");
  expect(window.history.length).toBe(length);
  expect(
    within(panel).getByRole("list", { name: "Recent notifications" }),
  ).toBeVisible();
  expect(within(panel).getAllByRole("listitem")).toHaveLength(4);
  expect(trigger).toHaveAccessibleName("Notifications, 2 unread");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it.each(["escape", "close", "bell"] as const)(
  "returns to settings without losing preferences when dismissed with %s",
  async (dismiss) => {
    const user = userEvent.setup();
    render(
      <PreviewProvider bootstrap={notificationFixture().bootstrap}>
        <NotificationCenter />
        <SettingsPage />
      </PreviewProvider>,
    );
    const larger = screen.getByRole("radio", { name: "Larger" });
    const reduced = screen.getByRole("radio", { name: "Reduce motion" });
    await user.click(larger);
    await user.click(reduced);
    const trigger = screen.getByRole("button", {
      name: "Notifications, 2 unread",
    });
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Notifications" }),
    ).not.toHaveAttribute("aria-modal", "true");
    if (dismiss === "escape") await user.keyboard("{Escape}");
    else if (dismiss === "close")
      await user.click(
        screen.getByRole("button", { name: "Close notifications" }),
      );
    else await user.click(trigger);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(larger).toBeChecked();
    expect(reduced).toBeChecked();
    expect(document.documentElement).toHaveAttribute(
      "data-reading-size",
      "larger",
    );
    expect(document.documentElement).toHaveAttribute("data-motion", "reduced");
    expect(trigger).toHaveAccessibleName("Notifications, 2 unread");
    expect(window.scrollTo).not.toHaveBeenCalled();
  },
);

it("dismisses when a settings control is clicked outside and leaves focus on that control", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={notificationFixture().bootstrap}>
      <NotificationCenter />
      <SettingsPage />
    </PreviewProvider>,
  );
  const trigger = screen.getByRole("button", {
    name: "Notifications, 2 unread",
  });
  await user.click(trigger);
  const extraLarge = screen.getByRole("radio", {
    name: "Extra large",
  });
  await user.click(extraLarge);
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(extraLarge).toBeChecked();
  expect(extraLarge).toHaveFocus();
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "extra-large",
  );
  expect(trigger).toHaveAccessibleName("Notifications, 2 unread");
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it("marks visible items read explicitly while retaining muted likes for opt-in", async () => {
  const user = userEvent.setup();
  setup(true);
  await user.click(
    screen.getByRole("button", { name: "Notifications, 2 unread" }),
  );
  await user.click(screen.getByRole("button", { name: "Mark all as read" }));
  expect(
    screen.getByRole("button", { name: "Notifications, 0 unread" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(
    "All visible notifications marked as read.",
  );
  expect(
    screen.getByRole("button", { name: "Mark all as read" }),
  ).toBeDisabled();
  await user.keyboard("{Escape}");
  await user.click(
    screen.getByRole("checkbox", { name: /Likes Grouped together/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Notifications, 1 unread" }),
  );
  expect(
    screen.getByRole("button", { name: /Theo and 2 others liked your post/ }),
  ).toBeVisible();
  expect(
    screen
      .getByRole("list", { name: "Recent notifications" })
      .querySelectorAll('[data-unread="true"]'),
  ).toHaveLength(1);
});
it("handles expired content without routing and opens a friend's profile through a safe internal URL", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(
    screen.getByRole("button", { name: "Notifications, 2 unread" }),
  );
  await user.click(
    screen.getByRole("button", { name: /This content is no longer available/ }),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "This content is no longer available.",
  );
  expect(push).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: /Nadia sent you a friend request/ }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith("/?view=profile&person=nadia"),
  );
  expect(
    screen.getByRole("button", { name: "Notifications, 1 unread" }),
  ).toBeInTheDocument();
});
it("uses a modal mobile list, supports browser Back, and preserves feed scroll and bell focus", async () => {
  viewport(false);
  const getRandomValues = globalThis.crypto.getRandomValues.bind(
    globalThis.crypto,
  );
  vi.stubGlobal("crypto", { getRandomValues });
  const user = userEvent.setup();
  setup();
  const trigger = screen.getByRole("button", {
    name: "Notifications, 2 unread",
  });
  await user.click(trigger);
  expect(screen.getByRole("dialog", { name: "Notifications" })).toHaveAttribute(
    "aria-modal",
    "true",
  );
  expect(window.history.state.marginNotifications).toMatch(/^[a-f0-9]{32}$/);
  expect(window.location.hash).toBe("#notifications");
  window.history.back();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(window.location.hash).toBe("");
  expect(window.scrollTo).not.toHaveBeenCalled();
  await user.click(trigger);
  await user.click(
    screen.getByRole("button", { name: "Back from notifications" }),
  );
  await waitFor(() => expect(window.location.hash).toBe(""));
  await waitFor(() => expect(trigger).toHaveFocus());
});
it("navigates to preferences without asking for browser push permission", async () => {
  const requestPermission = vi.fn();
  vi.stubGlobal("Notification", { requestPermission });
  const user = userEvent.setup();
  setup();
  await user.click(
    screen.getByRole("button", { name: "Notifications, 2 unread" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Notification preferences" }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      "/?view=settings#notification-preferences",
    ),
  );
  expect(requestPermission).not.toHaveBeenCalled();
});
it.each([true, false])(
  "opens the exact reply, expands its thread and returns focus to the post (desktop: %s)",
  async (desktop) => {
    viewport(desktop);
    const user = userEvent.setup();
    const { bootstrap, post } = notificationFixture();
    render(
      <PreviewProvider bootstrap={bootstrap}>
        <NotificationCenter />
        <FeedExperience
          posts={[post]}
          profileId="ines"
          referenceTime={notificationNow}
          renderedPosts={{}}
        />
      </PreviewProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Notifications, 2 unread" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Theo replied to you/ }),
    );
    const conversation = await screen.findByRole("dialog", {
      name: "Conversation on Ines’s post",
    });
    expect(within(conversation).getByText("A thoughtful reply.")).toBeVisible();
    expect(
      within(conversation).getByRole("button", { name: "Hide replies" }),
    ).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(document.activeElement?.id).toBe(
        "comment-post-notification-reply",
      ),
    );
    expect(push).toHaveBeenCalledWith("/?view=profile", { scroll: false });
    await user.click(
      within(conversation).getByRole("button", { name: "Back to post" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Conversation on Ines’s post" }),
      ).toHaveFocus(),
    );
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
    await waitFor(() => expect(window.location.hash).toBe(""));
  },
);

it("rechecks the actual post audience before opening a notification target", async () => {
  const user = userEvent.setup();
  const { bootstrap, post } = notificationFixture();
  bootstrap.friendships = [];
  const inaccessible = { ...post, author: bootstrap.profiles[1].person };
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <NotificationCenter />
      <FeedExperience
        posts={[inaccessible]}
        profileId="ines"
        referenceTime={notificationNow}
        renderedPosts={{}}
      />
    </PreviewProvider>,
  );
  expect(
    screen.queryByText("Something worth discussing."),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "Notifications, 1 unread" }),
  );
  await user.click(screen.getByRole("button", { name: /Theo replied to you/ }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(
      "This content is no longer available.",
    ),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByText("A thoughtful reply.")).not.toBeInTheDocument();
});
