import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpacesList } from "@/features/spaces/spaces-list";
import { SpaceDetails } from "@/features/spaces/space-details";
import type { SpaceDetails as Data } from "@/features/spaces/contracts";
import { ApplicationNavigation } from "@/components/layout/application-navigation";
const { push, replace, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
}));
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  vi.unstubAllGlobals();
});
it("keeps Spaces between Feed and Messages on both navigation bars", () => {
  render(
    <ApplicationNavigation
      live
      active="spaces"
      headerActions={null}
      mobileProfile={null}
    />,
  );
  const desktop = screen.getByRole("navigation", { name: "Primary" });
  expect(
    within(desktop)
      .getAllByRole("link")
      .map((n) => n.textContent),
  ).toEqual(["Feed", "Spaces", "Messages"]);
  const mobile = screen.getByRole("navigation", { name: "Mobile navigation" });
  expect(
    within(mobile)
      .getAllByRole("link")
      .map((n) => n.textContent),
  ).toEqual(["Feed", "Spaces", "Messages", "Profile"]);
  expect(within(mobile).getByRole("link", { name: "Spaces" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
it("creates a private Gathering using the selected local time zone", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ id: "event-one" }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacesList data={{ spaces: [], invitations: [], nextCursor: null }} />,
  );
  await user.click(screen.getByRole("button", { name: "New Space" }));
  await user.click(screen.getByRole("radio", { name: "Gathering Space" }));
  await user.type(screen.getByLabelText("Gathering Space name"), "Dinner");
  fireEvent.change(screen.getByLabelText("Date", { exact: true }), {
    target: { value: "2027-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Time", { exact: true }), {
    target: { value: "18:00" },
  });
  await user.click(screen.getByRole("combobox", { name: "Time zone" }));
  await user.type(screen.getByRole("combobox", { name: "Time zone" }), "Tokyo");
  await user.click(screen.getByRole("option", { name: "Asia / Tokyo" }));
  await user.click(screen.getByRole("button", { name: "Create Space" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalled());
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
    kind: "GATHERING",
    name: "Dinner",
    startsAt: "2027-01-01T09:00:00.000Z",
    timeZone: "Asia/Tokyo",
  });
  expect(push).toHaveBeenCalledWith("/app/spaces/event-one");
});
it("changes only the current member's feed preference and preserves archived read-only controls", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const data: Data = {
    id: "room",
    name: "Dinner",
    kind: "GATHERING",
    startsAt: "2027-01-01T20:00:00Z",
    timeZone: "Europe/Paris",
    location: "At home",
    archivedAt: "2027-01-02T00:00:00Z",
    memberCount: 1,
    creatorId: "me",
    viewerId: "me",
    role: "ADMIN",
    includeInFeed: false,
    rsvp: "GOING",
    members: [],
    blockedMembers: [],
  };
  render(<SpaceDetails data={data} />);
  expect(
    within(screen.getByRole("group", { name: "Your RSVP" })).getByRole(
      "button",
      { name: "Going" },
    ),
  ).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Space settings" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByText("Space options", { exact: true }));
  await user.click(screen.getByRole("checkbox"));
  expect(fetcher).toHaveBeenCalledWith(
    "/api/spaces/room/members",
    expect.objectContaining({
      body: JSON.stringify({ action: "preferences", includeInFeed: true }),
    }),
  );
});

it("retains an uncertain Space draft and prevents a second publish", async () => {
  const { SpaceComposer } = await import("@/features/spaces/space-composer");
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("Disconnected"));
  vi.stubGlobal("fetch", fetcher);
  render(<SpaceComposer spaceId="room" />);
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  await user.type(screen.getByLabelText("Your post"), "Keep this draft");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled(),
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Your post")).toHaveValue("Keep this draft");
  expect(
    screen.getByRole("button", { name: "Reload to check saved changes" }),
  ).toBeVisible();
});
it("stages a saved Space photograph until Publish and sends its canonical reference with text", async () => {
  const { SpaceComposer } = await import("@/features/spaces/space-composer");
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>(async (_url, init) =>
    init?.method === "POST"
      ? new Response(JSON.stringify({ id: "saved" }), { status: 201 })
      : new Response(
          JSON.stringify({
            photos: [
              {
                id: "photo-one",
                description: "A saved photograph",
                width: 4,
                height: 3,
              },
            ],
            nextCursor: null,
          }),
        ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<SpaceComposer spaceId="room" />);
  await user.click(screen.getByRole("button", { name: "New photo post" }));
  const picker = await screen.findByRole("dialog", {
    name: "Choose a photograph",
  });
  await user.click(
    await within(picker).findByRole("button", {
      name: "Select A saved photograph",
    }),
  );
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(0);
  await user.click(
    within(picker).getByRole("button", { name: "Use Photograph" }),
  );
  await user.type(screen.getByLabelText("Your post"), "With a photograph");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/spaces/room/posts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          body: "With a photograph",
          photoIds: ["photo-one"],
        }),
      }),
    ),
  );
});
it("keeps a full Space photograph draft within three attachments when reopened from the photo shortcut", async () => {
  const { SpaceComposer } = await import("@/features/spaces/space-composer");
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            photos: [1, 2, 3].map((id) => ({
              id: `photo-${id}`,
              description: `Photograph ${id}`,
              width: 4,
              height: 3,
            })),
            nextCursor: null,
          }),
        ),
    ),
  );
  render(<SpaceComposer spaceId="room" />);
  await user.click(screen.getByRole("button", { name: "New photo post" }));
  for (const id of [1, 2, 3]) {
    const picker = await screen.findByRole("dialog", {
      name: "Choose a photograph",
    });
    await user.click(
      await within(picker).findByRole("button", {
        name: `Select Photograph ${id}`,
      }),
    );
    await user.click(
      within(picker).getByRole("button", { name: "Use Photograph" }),
    );
    if (id < 3)
      await user.click(screen.getByRole("button", { name: "Add Photographs" }));
  }
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "New photo post" }));
  expect(
    screen.queryByRole("dialog", { name: "Choose a photograph" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add Photographs" }),
  ).toBeDisabled();
});
it("does not turn a successful comment into a second create when only the subsequent refresh fails", async () => {
  const { SpacePostCard } = await import("@/features/spaces/space-post-card");
  const user = userEvent.setup();
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          comments: [],
          nextCursor: null,
          readOnly: false,
          viewer: { id: "me", name: "Alice" },
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "canonical-comment" }), {
        status: 201,
      }),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 503 }));
  vi.stubGlobal("fetch", fetcher);
  render(
    <SpacePostCard
      post={{
        id: "canonical-post",
        author: { id: "bob", name: "Bob" },
        createdAt: "2026-11-01T12:00:00Z",
        expiresAt: "2026-12-01T12:00:00Z",
        body: "Thought",
        photos: [],
        space: null,
      }}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Conversation on Bob’s post" }),
  );
  const input = await screen.findByLabelText("Add a comment");
  await user.type(input, "Saved once");
  await user.click(screen.getByRole("button", { name: "Post" }));
  expect(await screen.findByText("Comment saved.")).toBeInTheDocument();
  expect(input).toHaveValue("");
  expect(
    fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toHaveLength(1);
  expect(screen.getByRole("alert")).toHaveTextContent("Your comment was saved");
});

it("publishes a Space thought and sends a targeted invitation through the shared form controls", async () => {
  const { SpaceComposer } = await import("@/features/spaces/space-composer");
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ id: "saved" }), { status: 201 }),
  );
  vi.stubGlobal("fetch", fetcher);
  const view = render(<SpaceComposer spaceId="room" />);
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  await user.type(screen.getByLabelText("Your post"), "Shared thought");
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Your post")).not.toBeInTheDocument(),
  );
  expect(fetcher).toHaveBeenCalledWith(
    "/api/spaces/room/posts",
    expect.objectContaining({
      body: JSON.stringify({ body: "Shared thought", photoIds: [] }),
    }),
  );
  view.unmount();
  render(
    <SpaceDetails
      data={{
        id: "room",
        name: "Room",
        kind: "PRIVATE",
        startsAt: null,
        timeZone: null,
        location: null,
        archivedAt: null,
        memberCount: 1,
        creatorId: "me",
        viewerId: "me",
        role: "ADMIN",
        includeInFeed: false,
        rsvp: null,
        members: [],
        blockedMembers: [],
      }}
    />,
  );
  await user.click(screen.getByText("Members", { exact: true }));
  fetcher.mockImplementation(async (_url, init) =>
    init?.method === "POST"
      ? Response.json({ id: "invitation" })
      : Response.json({
          members: [
            {
              person: {
                id: "target",
                name: "Target",
                initials: "T",
                tone: "paper",
              },
              username: "target",
              friend: true,
            },
          ],
          hasMore: false,
        }),
  );
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  await user.click(
    await screen.findByRole("button", { name: "Invite Target" }),
  );
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      "/api/spaces/room/invitations",
      expect.objectContaining({ body: JSON.stringify({ targetId: "target" }) }),
    ),
  );
});

it("sends local navigation to the development preview while live navigation retains the account gate", () => {
  const view = render(
    <ApplicationNavigation
      active="spaces"
      headerActions={null}
      mobileProfile={null}
    />,
  );
  for (const link of screen.getAllByRole("link", { name: "Spaces" }))
    expect(link).toHaveAttribute("href", "/preview/spaces");
  view.rerender(
    <ApplicationNavigation
      live
      active="spaces"
      headerActions={null}
      mobileProfile={null}
    />,
  );
  for (const link of screen.getAllByRole("link", { name: "Spaces" }))
    expect(link).toHaveAttribute("href", "/app/spaces");
});

it.each([false, true])(
  "confirms leaving a Space, preserves cancellation focus, and navigates after success (archived=%s)",
  async (archived) => {
    const { spacesFixture } = await import("./helpers/spaces-fixture");
    const user = userEvent.setup();
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetcher);
    const data = {
      ...spacesFixture().spaces[0],
      creatorId: "other",
      role: "MEMBER" as const,
      archivedAt: archived ? "2026-10-27T20:00:00Z" : null,
    };
    render(<SpaceDetails data={data} />);
    await user.click(screen.getByText("Members", { exact: true }));
    const trigger = screen.getByRole("button", {
      name: "Leave Space",
    });
    await user.click(trigger);
    const dialog = screen.getByRole("alertdialog", {
      name: "Leave Japan 2027?",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Leave Space",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/spaces"));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/spaces/sample-room/members",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "remove", userId: data.viewerId }),
      }),
    );
    // The old Space no longer belongs to the viewer; don't refresh its route.
    expect(refresh).not.toHaveBeenCalled();
  },
);

it("keeps a failed leave confirmation open and also lets the creator leave", async () => {
  const { spacesFixture } = await import("./helpers/spaces-fixture");
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ error: "Change unavailable" }), {
        status: 409,
      }),
  );
  vi.stubGlobal("fetch", fetcher);
  const data = spacesFixture().spaces[0];
  const view = render(
    <SpaceDetails data={{ ...data, creatorId: "other", role: "MEMBER" }} />,
  );
  await user.click(screen.getByText("Members", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Leave Space" }));
  const dialog = screen.getByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Leave Space" }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "Change unavailable",
  );
  expect(replace).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
  view.unmount();
  render(<SpaceDetails data={data} />);
  await user.click(screen.getByText("Members", { exact: true }));
  expect(screen.getByRole("button", { name: "Leave Space" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Delete Space" })).toBeVisible();
});

it("keeps member icon actions named and sends role/removal changes for the selected person", async () => {
  const { spacesFixture } = await import("./helpers/spaces-fixture");
  const user = userEvent.setup();
  const fetcher = vi.fn<typeof fetch>(
    async () => new Response(null, { status: 204 }),
  );
  vi.stubGlobal("fetch", fetcher);
  const data = spacesFixture().spaces[0];
  render(<SpaceDetails data={data} />);
  await user.click(screen.getByText("Members", { exact: true }));
  const actions = screen.getByRole("group", {
    name: "Actions for Theo Marchetti",
  });
  expect(
    within(actions).getByRole("button", { name: "Block Theo Marchetti" }),
  ).toHaveAttribute("title", "Block Theo Marchetti");
  await user.click(
    within(actions).getByRole("button", {
      name: "Make Theo Marchetti an administrator",
    }),
  );
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      `/api/spaces/${data.id}/members`,
      expect.objectContaining({
        body: JSON.stringify({ action: "role", userId: "theo", role: "ADMIN" }),
      }),
    ),
  );
  await user.click(
    within(actions).getByRole("button", {
      name: "Remove Theo Marchetti from Space",
    }),
  );
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      `/api/spaces/${data.id}/members`,
      expect.objectContaining({
        body: JSON.stringify({ action: "remove", userId: "theo" }),
      }),
    ),
  );
});

it("explains an empty photograph library and keeps a collapsed post draft", async () => {
  const { SpaceComposer } = await import("@/features/spaces/space-composer");
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ photos: [], nextCursor: null })),
    ),
  );
  render(<SpaceComposer spaceId="room" />);
  const share = screen.getByRole("button", { name: "Share a thought…" });
  await user.click(share);
  await user.type(
    screen.getByLabelText("Your post"),
    "Come back to this thought",
  );
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(share);
  expect(screen.getByLabelText("Your post")).toHaveValue(
    "Come back to this thought",
  );
  await user.click(screen.getByRole("button", { name: "Add Photographs" }));
  expect(await screen.findByText("No photographs here yet.")).toBeVisible();
});
