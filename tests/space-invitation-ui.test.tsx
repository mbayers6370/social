import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberNotifications } from "@/features/social/member-notifications";
import { MemberProvider } from "@/features/social/member-provider";
import { sampleIdentity } from "@/features/social/member-preview";
import { SpaceClientProvider } from "@/features/spaces/client";
import { SpacesList } from "@/features/spaces/spaces-list";
import type { MemberActivity } from "@/features/social/member-contracts";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const invitation = { id: "invitation-one", space: { name: "Saturday Dinner" } };
const notification: MemberActivity = {
  id: "notification-one",
  kind: "space_invitation",
  invitation,
  actor: { id: "host", name: "Alex Example", initials: "AE", tone: "paper" },
  href: "/app/spaces#space-invitations",
  createdAt: "2026-11-03T12:00:00Z",
  read: false,
};
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());
function view(notifications = true) {
  return (
    <SpaceClientProvider
      client={{
        request,
        href: (url) => url,
        photoSrc: (id) => `/api/photos/${id}`,
        preview: false,
      }}
    >
      <MemberProvider initial={sampleIdentity}>
        {notifications ? (
          <MemberNotifications />
        ) : (
          <SpacesList
            data={{ spaces: [], invitations: [invitation], nextCursor: null }}
          />
        )}
      </MemberProvider>
    </SpaceClientProvider>
  );
}
it("shows an unread Space invitation in the bell and joins directly without marking it read or navigating prematurely", async () => {
  const user = userEvent.setup();
  let joined = false;
  request.mockImplementation(async (url) => {
    if (url === "/api/member/context") return Response.json(sampleIdentity);
    if (url === "/api/notifications")
      return Response.json({
        activity: joined ? [] : [notification],
        nextCursor: null,
      });
    if (url === "/api/space-invitations/invitation-one/accept") {
      joined = true;
      return Response.json({ id: "dinner" });
    }
    throw Error("Unexpected endpoint");
  });
  render(view());
  await user.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Notifications" });
  expect(
    within(dialog).getByText(/invited you to Saturday Dinner/),
  ).toBeVisible();
  expect(router.push).not.toHaveBeenCalled();
  await user.click(
    within(dialog).getByRole("button", {
      name: "Join Saturday Dinner",
    }),
  );
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith("/app/spaces/dinner"),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(request).toHaveBeenCalledWith(
    "/api/space-invitations/invitation-one/accept",
    expect.objectContaining({ method: "POST" }),
  );
  expect(
    request.mock.calls.some(
      ([url, init]) => url === "/api/notifications" && init?.method === "PUT",
    ),
  ).toBe(false);
});
it("keeps a failed invitation acceptance visible and lets the recipient retry", async () => {
  const user = userEvent.setup();
  let fail = true;
  request.mockImplementation(async (url) =>
    url === "/api/member/context"
      ? Response.json(sampleIdentity)
      : url === "/api/notifications"
        ? Response.json({ activity: [notification], nextCursor: null })
        : fail
          ? Response.json(
              { error: "The invitation could not be accepted. Try again." },
              { status: 503 },
            )
          : Response.json({ id: "dinner" }),
  );
  render(view());
  await user.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Join Saturday Dinner" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "The invitation could not be accepted. Try again.",
  );
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(router.push).not.toHaveBeenCalled();
  fail = false;
  await user.click(
    screen.getByRole("button", { name: "Join Saturday Dinner" }),
  );
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith("/app/spaces/dinner"),
  );
});
it("uses the same join flow on the Spaces invitation card", async () => {
  request.mockImplementation(async (url) =>
    Response.json(
      url === "/api/member/context" ? sampleIdentity : { id: "dinner" },
    ),
  );
  const user = userEvent.setup();
  render(view(false));
  const card = screen.getByRole("region", { name: "Space invitations" });
  expect(
    within(card).getByText("Saturday Dinner", { exact: true }),
  ).toBeVisible();
  await user.click(
    within(card).getByRole("button", {
      name: "Join Saturday Dinner",
    }),
  );
  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith("/app/spaces/dinner"),
  );
});
