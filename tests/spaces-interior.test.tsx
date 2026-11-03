import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SpaceDetails } from "@/features/spaces/space-details";
import type { SpaceDetails as Data } from "@/features/spaces/contracts";
import { spacesFixture } from "./helpers/spaces-fixture";
import { calvinEvent } from "./helpers/ticketmaster-fixture";
import { SpaceRsvp } from "@/features/spaces/space-rsvp";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
  }: {
    src: string;
    alt: string;
    width: number;
    height: number;
  }) => (
    // The browser checks exercise Next Image; this mock only supplies component geometry.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} />
  ),
}));
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const gathering = (): Data => ({
  ...spacesFixture().spaces[0],
  kind: "GATHERING",
  startsAt: "2027-06-01T09:00:00Z",
  timeZone: "Asia/Tokyo",
  location: "Kyoto, Japan",
});
const event = (): Data => ({
  ...gathering(),
  ...calvinEvent,
  id: "public",
  kind: "EVENT",
  ticketmasterId: calvinEvent.id,
  endsAt: "2026-11-08T10:30:00Z",
  expiresAt: "2026-11-10T10:30:00Z",
});
it("keeps Gathering date, location and RSVP immediately available while hiding administration", async () => {
  const user = userEvent.setup();
  render(
    <SpaceDetails data={gathering()}>
      <article>A shared plan</article>
    </SpaceDetails>,
  );
  const info = screen.getByRole("region", {
    name: "Gathering and event details",
  });
  expect(within(info).getByText("Kyoto, Japan")).toBeVisible();
  expect(screen.getByRole("group", { name: "Your RSVP" })).toBeVisible();
  expect(
    screen.queryByRole("combobox", { name: "Your RSVP" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("About this Space")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Space settings" }),
  ).not.toBeVisible();
  expect(
    screen.queryByRole("button", {
      name: "Archive Gathering Space",
    }),
  ).not.toBeVisible();
  await user.click(screen.getByText("Space options", { exact: true }));
  expect(screen.getByRole("button", { name: "Space settings" })).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "Archive Gathering Space",
    }),
  ).toBeVisible();
});
it("keeps Private Space posts and members in view without an event-control panel", () => {
  render(
    <SpaceDetails data={spacesFixture().spaces[0]}>
      <article>A conversation among friends</article>
    </SpaceDetails>,
  );
  expect(screen.getByRole("article")).toBeVisible();
  expect(screen.getByText("Members", { exact: true })).toBeVisible();
  expect(
    screen.queryByRole("group", { name: "Your RSVP" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: "Gathering and event details" }),
  ).not.toBeInTheDocument();
});
it("saves RSVP buttons through the membership action and preserves the saved response on failure", async () => {
  const user = userEvent.setup();
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Please try again." }), {
        status: 503,
      }),
    );
  vi.stubGlobal("fetch", request);
  const data = { ...gathering(), rsvp: "GOING" as const };
  const view = render(<SpaceRsvp data={data} />);
  await user.click(screen.getByRole("button", { name: "Maybe" }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `/api/spaces/${data.id}/members`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "rsvp", rsvp: "MAYBE" }),
      }),
    ),
  );
  view.rerender(<SpaceRsvp data={{ ...data, rsvp: "MAYBE" }} />);
  expect(screen.getByRole("button", { name: "Maybe" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Clear response" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again.",
  );
  expect(screen.getByRole("button", { name: "Maybe" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(request).toHaveBeenLastCalledWith(
    `/api/spaces/${data.id}/members`,
    expect.objectContaining({
      body: JSON.stringify({ action: "rsvp", rsvp: null }),
    }),
  );
});
it("keeps archived RSVP responses read-only", () => {
  render(
    <SpaceRsvp
      data={{
        ...gathering(),
        archivedAt: "2026-11-01T00:00:00Z",
        rsvp: "GOING",
      }}
    />,
  );
  for (const button of screen.getAllByRole("button"))
    expect(button).toBeDisabled();
  expect(screen.getByRole("button", { name: "Going" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
it("invites the first contribution and opens the existing composer with keyboard focus", async () => {
  const user = userEvent.setup();
  render(<SpaceDetails data={event()} hasPosts={false} />);
  expect(
    screen.getByText(/disappears from Your Spaces and search/),
  ).toBeVisible();
  expect(screen.getByText(/photos become inaccessible here/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Write the first post" }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Your post", { exact: true })).toHaveFocus(),
  );
  expect(screen.getByLabelText("Your post", { exact: true })).toBeVisible();
});
it("replaces content with an explicit unavailable message at the Event Space deadline", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:29:59.900Z"));
  render(
    <SpaceDetails data={event()}>
      <article>Only available before expiry</article>
    </SpaceDetails>,
  );
  expect(screen.getByRole("article")).toBeVisible();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(
    screen.getByRole("heading", { name: "This Event Space has expired" }),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  expect(
    screen.getByText(/photos can no longer be viewed through this Space/),
  ).toBeVisible();
});
