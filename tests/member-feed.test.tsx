import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberFeed } from "@/features/social/member-feed";

const { refresh, manage, leave } = vi.hoisted(() => ({
  refresh: vi.fn(),
  manage: vi.fn(),
  leave: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/components/auth/account-session", () => ({
  useAccountSession: () => ({
    ready: true,
    available: true,
    managed: true,
    signedIn: true,
    manage,
    leave,
  }),
}));
const request = vi.fn();
const data = {
  viewer: { id: "saved-member", name: "Saved member" },
  page: { posts: [], nextCursor: null, hasFriends: false },
};
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    url === "/api/posts/allowance"
      ? Promise.resolve(
          Response.json({ regularRemaining: 3, linkAllowed: true }),
        )
      : request(url, init),
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("shows the ordinary member feed with real identity, composition and an invitation empty state", () => {
  render(<MemberFeed data={data} referenceTime="2026-11-02T20:00:00Z" />);
  expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
  expect(screen.getByText("Monday 2 November")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Share a thought…" }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "It starts with your people." }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Invite someone" })).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/founder|owner dashboard/i),
  ).not.toBeInTheDocument();
});

it("uses the existing profile menu for member navigation and account actions, including Escape focus return", async () => {
  const user = userEvent.setup();
  render(<MemberFeed data={data} referenceTime="2026-11-02T20:00:00Z" />);
  expect(
    screen.queryByRole("button", { name: "Sign out" }),
  ).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", { name: "Profile menu" });
  await user.click(trigger);
  const menu = screen.getByRole("navigation", { name: "Profile menu" });
  expect(
    within(menu).getByRole("link", { name: "View profile" }),
  ).toHaveAttribute("href", "/app");
  expect(within(menu).getByRole("link", { name: "Friends" })).toHaveAttribute(
    "href",
    "/app/friends",
  );
  await user.click(
    within(menu).getByRole("button", { name: "Account & security" }),
  );
  expect(manage).toHaveBeenCalled();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(
    screen.queryByRole("navigation", { name: "Profile menu" }),
  ).not.toBeInTheDocument();
});

it("preserves a cancelled draft and returns focus, then publishes through the existing server boundary", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(new Response("{}", { status: 201 }));
  render(<MemberFeed data={data} referenceTime="2026-11-02T20:00:00Z" />);
  const trigger = screen.getByRole("button", { name: "Share a thought…" });
  await user.click(trigger);
  await user.type(screen.getByLabelText("Your post"), "Saved personal draft");
  await user.keyboard("{Escape}");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Share a thought…" }),
    ).toHaveFocus(),
  );
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  expect(screen.getByLabelText("Your post")).toHaveValue(
    "Saved personal draft",
  );
  await user.click(screen.getByRole("button", { name: "Publish" }));
  expect(request).toHaveBeenCalledWith(
    "/api/posts/publish",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ body: "Saved personal draft", photoIds: [] }),
    }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Post shared with friends.",
  );
  expect(refresh).toHaveBeenCalled();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});

it("offers recovery for load failure without a composer, sample content or invitations", () => {
  render(
    <MemberFeed
      data={null}
      error="Your feed could not be loaded. Please try again."
      referenceTime="2026-11-02T20:00:00Z"
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Your feed could not be loaded.",
  );
  expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "/app/feed",
  );
  expect(
    screen.queryByRole("button", { name: "Share a thought…" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Invite someone" }),
  ).not.toBeInTheDocument();
});

it("shows a quiet-day message for existing friendships instead of asking for new invitations", () => {
  render(
    <MemberFeed
      data={{ ...data, page: { ...data.page, hasFriends: true } }}
      referenceTime="2026-11-02T20:00:00Z"
    />,
  );
  expect(
    screen.getByRole("heading", { name: "A quiet day in your circle." }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Invite someone" }),
  ).not.toBeInTheDocument();
});
