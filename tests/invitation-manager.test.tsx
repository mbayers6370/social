import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvitationManager } from "@/features/account/invite-friends";

const request = vi.fn<typeof fetch>();
const link = {
  id: "personal",
  url: "https://margin.social/invite/personal-link",
  expiresAt: "2026-12-03T20:00:00Z",
  accepted: 0,
  maximum: 1,
};
const shareDescriptor = Object.getOwnPropertyDescriptor(navigator, "share");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T20:00:00Z"));
  vi.stubGlobal("fetch", request);
  request.mockReset();
  request.mockResolvedValue(
    Response.json({ founder: false, remaining: 2, links: [link] }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (shareDescriptor)
    Object.defineProperty(navigator, "share", shareDescriptor);
  else Reflect.deleteProperty(navigator, "share");
});

it("leads with an existing link, copies without creating, and keeps help and history optional", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<InvitationManager available />);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  const field = await screen.findByLabelText("Your invitation link");
  expect(field).toHaveValue(link.url);
  expect(screen.getByText("2 of 3 invitations left")).toBeVisible();
  expect(screen.getByText(/Expires 3 Dec · One person can join/)).toBeVisible();
  expect(
    screen.queryByRole("button", {
      name: /Invite another person|Invite by email|Refresh invitations/,
    }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Each personal link/)).not.toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "How invitations work" }),
  );
  expect(screen.getByText(/Each personal link/)).toBeVisible();
  const history = screen.getByRole("region", { name: "Your invitations" });
  expect(
    within(history).queryByRole("button", { name: "Show link" }),
  ).not.toBeInTheDocument();
  await user.click(within(history).getByRole("button", { name: "Show" }));
  expect(
    within(history).getByRole("button", { name: "Show link" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Copy link" }));
  expect(copy).toHaveBeenCalledWith(link.url);
  expect(
    screen.getByRole("button", { name: "Invite another person" }),
  ).toBeVisible();
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1]?.method).toBeUndefined();
});

it("keeps one link through cancelled and failed native sharing, then permits another after success", async () => {
  const user = userEvent.setup();
  const share = vi
    .fn()
    .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"))
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockResolvedValue(undefined);
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  render(<InvitationManager available />);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  const button = await screen.findByRole("button", {
    name: "Share",
  });
  await user.click(button);
  expect(
    screen.queryByRole("button", { name: "Invite another person" }),
  ).not.toBeInTheDocument();
  await user.click(button);
  expect(screen.getByText(/Sharing didn’t work/)).toBeVisible();
  expect(screen.getByLabelText("Your invitation link")).toHaveValue(link.url);
  await user.click(button);
  expect(
    screen.getByRole("button", { name: "Invite another person" }),
  ).toBeVisible();
  expect(share).toHaveBeenLastCalledWith(
    expect.objectContaining({ url: link.url }),
  );
  expect(request).toHaveBeenCalledTimes(1);
});

it("creates only on request and preserves founder fields and request ID across a failed retry", async () => {
  const user = userEvent.setup();
  const bodies: Record<string, unknown>[] = [];
  request.mockImplementation(async (_url, init) => {
    if (init?.method === "POST") {
      bodies.push(JSON.parse(init.body as string));
      return bodies.length === 1
        ? Response.json({ error: "Try again." }, { status: 503 })
        : Response.json({ ...link, community: true }, { status: 201 });
    }
    return Response.json({ founder: true, remaining: 3, links: [] });
  });
  render(<InvitationManager available />);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  await user.click(
    await screen.findByRole("checkbox", {
      name: "Create a community invitation",
    }),
  );
  await user.type(screen.getByLabelText("Campaign label (optional)"), "Autumn");
  await user.clear(screen.getByLabelText("People who can join"));
  await user.type(screen.getByLabelText("People who can join"), "25");
  expect(bodies).toHaveLength(0);
  await user.click(
    screen.getByRole("button", { name: "Create invitation link" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
  await user.click(
    screen.getByRole("button", { name: "Create invitation link" }),
  );
  expect(await screen.findByLabelText("Your invitation link")).toHaveValue(
    link.url,
  );
  expect(screen.getByRole("button", { name: "Copy link" })).toHaveFocus();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[1]).toMatchObject({
    community: true,
    label: "Autumn",
    maxRedemptions: 25,
  });
});

it("refreshes an open modal quietly and stops polling after closing", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  let accepted = false;
  request.mockImplementation(async () =>
    Response.json({
      founder: false,
      remaining: accepted ? 3 : 2,
      links: [{ ...link, accepted: accepted ? 1 : 0 }],
    }),
  );
  render(<InvitationManager available />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
  });
  expect(screen.getByLabelText("Your invitation link")).toHaveValue(link.url);
  accepted = true;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_000);
  });
  expect(screen.getByText("3 of 3 invitations left")).toBeVisible();
  expect(screen.getByRole("button", { name: "Copy link" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Invite another person" }),
  ).toBeVisible();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  });
  const reads = request.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(request).toHaveBeenCalledTimes(reads);
});

it("sends an optional personal name and shows the saved name in history", async () => {
  const user = userEvent.setup();
  let created = false;
  request.mockImplementation(async (_url, init) => {
    if (init?.method === "POST") {
      expect(JSON.parse(init.body as string)).toMatchObject({
        community: false,
        label: "Sam",
      });
      created = true;
      return Response.json({ ...link, label: "Sam" }, { status: 201 });
    }
    return Response.json({
      founder: false,
      remaining: created ? 2 : 3,
      links: created ? [{ ...link, label: "Sam" }] : [],
    });
  });
  render(<InvitationManager available />);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  const name = await screen.findByLabelText("Who’s this for? (optional)");
  expect(name).not.toBeRequired();
  await user.type(name, "Sam");
  await user.click(
    screen.getByRole("button", { name: "Create invitation link" }),
  );
  await screen.findByLabelText("Your invitation link");
  await user.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("For Sam")).toBeVisible();
  expect(screen.getByText("Active · Expires 3 Dec")).toBeVisible();
});

it("distinguishes named links and omits withdrawn links without a follow-up action", async () => {
  const user = userEvent.setup();
  let withdrawn = false;
  request.mockImplementation(async (_url, init) => {
    if (init?.method === "DELETE") {
      withdrawn = true;
      return Response.json({ revoked: true, providerPending: true });
    }
    return Response.json({
      founder: false,
      remaining: withdrawn ? 2 : 1,
      links: [
        { ...link, label: "Sam", revoked: withdrawn },
        { ...link, id: "alex", label: "Alex" },
        { ...link, id: "old", label: "Old", revoked: true },
      ],
    });
  });
  render(<InvitationManager available />);
  await user.click(screen.getByRole("button", { name: "Invite someone" }));
  await screen.findByLabelText("Your invitation link");
  await user.click(screen.getByRole("button", { name: "Show" }));
  expect(screen.getByText("For Alex")).toBeVisible();
  expect(screen.queryByText("For Old")).not.toBeInTheDocument();
  const sam = screen.getByText("For Sam").closest("li")!;
  await user.click(
    within(sam).getByRole("button", { name: "Withdraw invitation" }),
  );
  expect(screen.queryByText("For Sam")).not.toBeInTheDocument();
  expect(screen.getByText("For Alex")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Check withdrawal" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Invitation withdrawn. Its slot is available again."),
  ).toBeVisible();
  expect(
    request.mock.calls.filter(([, init]) => init?.method === "DELETE"),
  ).toHaveLength(1);
});
