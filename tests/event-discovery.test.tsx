import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SpaceSettings } from "@/features/spaces/space-settings";
import { EventSearch } from "@/features/spaces/event-search";
import { SpaceClientProvider } from "@/features/spaces/client";
import {
  SpacesPreviewProvider,
  useSpacesPreview,
  type SpacesPreviewData,
} from "@/features/spaces/preview-provider";
import { visibleSpacePosts } from "@/features/spaces/preview-selectors";
import { spacesFixture } from "./helpers/spaces-fixture";
import { calvinEvent } from "./helpers/ticketmaster-fixture";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("?id=")
        ? Response.json({ event: calvinEvent })
        : Response.json({ events: [calvinEvent], nextPage: null }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
function renderPreview(data: SpacesPreviewData) {
  let session: ReturnType<typeof useSpacesPreview>;
  function Contents() {
    session = useSpacesPreview();
    return (
      <SpaceClientProvider client={session.client}>
        <EventSearch />
        {session.data.spaces
          .filter((space) => space.kind === "EVENT")
          .map((space) => (
            <SpaceSettings key={space.id} data={space} />
          ))}
      </SpaceClientProvider>
    );
  }
  render(
    <SpacesPreviewProvider bootstrap={data}>
      <Contents />
    </SpacesPreviewProvider>,
  );
  return () => session;
}
it("starts with an empty artist-only search and joins directly with a four-hour default", async () => {
  const user = userEvent.setup();
  const session = renderPreview(spacesFixture());
  expect(
    screen.getByRole("textbox", { name: "Search Event Spaces" }),
  ).toHaveValue("");
  expect(
    screen.queryByRole("heading", { name: calvinEvent.name }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: /City/ }),
  ).not.toBeInTheDocument();
  await user.type(
    screen.getByRole("textbox", { name: "Search Event Spaces" }),
    "Calvin Harris",
  );
  await user.click(screen.getByRole("button", { name: "Search events" }));
  expect(
    await screen.findByRole("heading", { name: calvinEvent.name }),
  ).toBeVisible();
  expect(screen.getByText(/10:30 PM PST/)).toBeVisible();
  expect(
    screen.getByRole("list", { name: "Event search results" }),
  ).toHaveTextContent("Disappears 10 Nov 2026 · 48 hours after the event ends");
  expect(screen.queryByText("Japan 2027")).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: `Join ${calvinEvent.name}` }),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      `/preview/spaces?space=ticketmaster-${calvinEvent.id}`,
    ),
  );
  expect(session().data.spaces[1]).toMatchObject({
    ticketmasterId: calvinEvent.id,
    kind: "EVENT",
    endsAt: "2026-11-08T10:30:00.000Z",
    expiresAt: "2026-11-10T10:30:00.000Z",
  });
});
it("reuses one provider identity on repeated joins without changing its scheduled end", async () => {
  const session = renderPreview(spacesFixture());
  const url = `/api/spaces/events/${calvinEvent.id}/join`;
  await act(async () => {
    expect(
      (
        await session().client.request(url, {
          method: "POST",
          body: JSON.stringify({}),
        })
      ).ok,
    ).toBe(true);
  });
  await act(async () => {
    expect(
      (
        await session().client.request(url, {
          method: "POST",
          body: JSON.stringify({}),
        })
      ).ok,
    ).toBe(true);
  });
  expect(session().data.spaces).toHaveLength(2);
  expect(session().data.spaces[1].memberCount).toBe(1);
  expect(session().data.spaces[1].expiresAt).toBe("2026-11-10T10:30:00.000Z");
});
it("lets an admin adjust the end and expiry through the schedule dialog", async () => {
  const user = userEvent.setup();
  // This fixture represents a host explicitly appointed by the founder.
  const data = spacesFixture();
  data.spaces.push({
    ...structuredClone(data.spaces[0]),
    ...calvinEvent,
    id: "appointed-event",
    kind: "EVENT",
    endsAt: "2026-11-08T10:30:00Z",
    expiresAt: "2026-11-10T10:30:00Z",
    role: "ADMIN",
  });
  const session = renderPreview(data);
  await user.click(screen.getByRole("button", { name: "Edit end time" }));
  expect(screen.getByLabelText("Scheduled end")).toHaveValue(
    "2026-11-08T02:30",
  );
  fireEvent.change(screen.getByLabelText("Scheduled end"), {
    target: { value: "2026-11-08T04:00" },
  });
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(session().data.spaces[1].expiresAt).toBe("2026-11-10T12:00:00.000Z"),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("keeps Gathering Spaces invitation-only and hides Event content at its exact expiry", async () => {
  const data = spacesFixture();
  const room = {
    ...structuredClone(data.spaces[0]),
    kind: "EVENT" as const,
    id: "expired",
    expiresAt: "2026-10-26T00:00:00Z",
    endsAt: "2026-10-24T00:00:00Z",
  };
  data.spaces.push(room);
  data.posts[0].space = { id: room.id, name: room.name, archived: false };
  const session = renderPreview(data);
  expect(session().detailsFor("expired")).toBeUndefined();
  expect(
    visibleSpacePosts(data, [], Date.parse(room.expiresAt), room.id),
  ).toEqual([]);
  await act(async () => {
    expect(
      (
        await session().client.request("/api/spaces/sample-room/join", {
          method: "POST",
        })
      ).ok,
    ).toBe(false);
  });
});
it("shows provider failures with a retry and recovers without losing the search input", async () => {
  const user = userEvent.setup();
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ events: [], nextCursor: null }));
  render(
    <SpaceClientProvider
      client={{
        request,
        preview: false,
        href: (url) => url,
        photoSrc: (id) => id,
      }}
    >
      <EventSearch />
    </SpaceClientProvider>,
  );
  await user.type(
    screen.getByRole("textbox", { name: "Search Event Spaces" }),
    "Calvin Harris",
  );
  await user.click(screen.getByRole("button", { name: "Search events" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "temporarily unavailable",
  );
  await user.click(screen.getByRole("button", { name: "Search events" }));
  expect(await screen.findByText(/No events found/)).toBeVisible();
  expect(
    screen.getByRole("textbox", { name: "Search Event Spaces" }),
  ).toHaveValue("Calvin Harris");
});
