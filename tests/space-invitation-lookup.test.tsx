import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceInvitation } from "@/features/spaces/space-invitation";
import {
  SpaceClientProvider,
  type SpaceClient,
} from "@/features/spaces/client";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
const member = (id: string, friend = false) => ({
  person: { id, name: id, initials: id[0], tone: "paper" as const },
  username: id.toLowerCase(),
  friend,
});
function setup(request: SpaceClient["request"]) {
  render(
    <SpaceClientProvider
      client={{
        request,
        href: (url) => url,
        photoSrc: (id) => `/api/photos/${id}`,
        preview: false,
      }}
    >
      <SpaceInvitation spaceId="room" />
    </SpaceClientProvider>,
  );
}
it("starts with friends, searches by handle, and sends only the explicitly selected member ID", async () => {
  const user = userEvent.setup();
  const request = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? Response.json({ id: "invite" })
      : Response.json({
          members: [member("Zoe", true), member("Adam")],
          hasMore: false,
        }),
  );
  setup(request);
  expect(request).not.toHaveBeenCalled();
  const trigger = screen.getByRole("button", { name: "Invite someone" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Invite to this Space" });
  await within(dialog).findByRole("button", { name: "Invite Zoe" });
  const groups = within(dialog).getAllByRole("heading", { level: 3 });
  expect(groups.map((heading) => heading.textContent)).toEqual([
    "Your friends",
    "Other members",
  ]);
  const input = within(dialog).getByRole("searchbox", {
    name: "Search members",
  });
  expect(input).toHaveAttribute("autocomplete", "off");
  await user.type(input, "@adam");
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      "/api/spaces/room/invitations?q=adam",
      expect.objectContaining({ signal: expect.anything() }),
    ),
  );
  await user.click(
    await within(dialog).findByRole("button", { name: "Invite Adam" }),
  );
  await waitFor(() =>
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Invitation sent to Adam.",
    ),
  );
  expect(
    request.mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toEqual([
    [
      "/api/spaces/room/invitations",
      expect.objectContaining({ body: JSON.stringify({ targetId: "Adam" }) }),
    ],
  ]);
  expect(
    within(dialog).getByRole("button", { name: "Adam invited" }),
  ).toBeDisabled();
  await user.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
});
it("ignores stale lookup responses so a changed search cannot invite the wrong person", async () => {
  const user = userEvent.setup();
  let old!: (response: Response) => void;
  let latest!: (response: Response) => void;
  const request = vi.fn((url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? Promise.reject(Error("Unexpected invitation send"))
      : url.endsWith("q=alice")
        ? new Promise<Response>((resolve) => {
            old = resolve;
          })
        : url.endsWith("q=bob")
          ? new Promise<Response>((resolve) => {
              latest = resolve;
            })
          : Promise.resolve(Response.json({ members: [], hasMore: false })),
  );
  setup(request);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  const input = screen.getByRole("searchbox", { name: "Search members" });
  await user.type(input, "alice");
  await waitFor(() => expect(old).toBeTypeOf("function"));
  await user.clear(input);
  await user.type(input, "bob");
  await waitFor(() => expect(latest).toBeTypeOf("function"));
  latest(Response.json({ members: [member("Bob")], hasMore: false }));
  await screen.findByRole("button", { name: "Invite Bob" });
  old(Response.json({ members: [member("Alice")], hasMore: false }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Invite Alice" }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Invite Bob" })).toBeEnabled();
  expect(request.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(
    true,
  );
});
it("keeps the query after a failed search and supports an explicit retry", async () => {
  const user = userEvent.setup();
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: "Search unavailable" }, { status: 503 }),
    )
    .mockImplementation(async () =>
      Response.json({ members: [member("Friend", true)], hasMore: false }),
    );
  setup(request);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Search unavailable",
  );
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("button", { name: "Invite Friend" }),
  ).toBeEnabled();
});
