import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberProvider } from "@/features/social/member-provider";
import { MemberSettings } from "@/features/social/member-settings";
import { MemberMessages } from "@/features/social/member-messages";
import { PrivateProfile } from "@/features/social/private-profile";
import { MemberNotifications } from "@/features/social/member-notifications";
import {
  sampleIdentity,
  sampleProfile,
  sampleConversation,
} from "@/features/social/member-preview";
import { SpaceClientProvider } from "@/features/spaces/client";
import type { MemberIdentity } from "@/features/social/member-contracts";
import type { ReactNode } from "react";
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const request = vi.fn<typeof fetch>();
const client = {
  request,
  href: (url: string) => url,
  photoSrc: (id: string) => `/api/photos/${id}`,
  preview: false,
};
let identity: MemberIdentity;
beforeEach(() => {
  vi.clearAllMocks();
  identity = structuredClone(sampleIdentity);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  request.mockImplementation(async (url) => {
    if (url === "/api/member/context") return Response.json(identity);
    if (url === "/api/notifications")
      return Response.json({ activity: [], nextCursor: null });
    throw Error("Unexpected fixture request");
  });
});
afterEach(() => vi.unstubAllGlobals());
function view(children: ReactNode, initial = identity) {
  return (
    <SpaceClientProvider client={client}>
      <MemberProvider initial={initial}>{children}</MemberProvider>
    </SpaceClientProvider>
  );
}
it("starts enabled, keeps messaging on after a save failure, and restores navigation when turned back on", async () => {
  const user = userEvent.setup();
  let attempts = 0;
  request.mockImplementation(async (url, init) => {
    if (url === "/api/member/context") return Response.json(identity);
    if (url === "/api/notifications")
      return Response.json({ activity: [], nextCursor: null });
    if (url === "/api/member/preferences") {
      if (++attempts === 1)
        return Response.json(
          { error: "Settings could not be saved." },
          { status: 503 },
        );
      identity = {
        ...identity,
        preferences: {
          ...identity.preferences,
          ...JSON.parse(init!.body as string),
        },
      };
      return Response.json(identity);
    }
    throw Error("Unexpected fixture request");
  });
  render(
    view(
      <MemberSettings
        initial={identity}
        safety={{ blocked: [], reports: [] }}
      />,
    ),
  );
  const toggle = screen.getByRole("checkbox", { name: /Allow messaging/ });
  expect(toggle).toBeChecked();
  expect(
    within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
      "link",
      { name: "Messages" },
    ),
  ).toBeInTheDocument();
  await user.click(toggle);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Settings could not be saved",
  );
  expect(toggle).toBeChecked();
  await user.click(toggle);
  await waitFor(() => expect(toggle).not.toBeChecked());
  expect(screen.queryAllByRole("link", { name: "Messages" })).toHaveLength(0);
  expect(
    screen.getByRole("checkbox", { name: /^Messages New private/ }),
  ).toBeDisabled();
  await user.click(toggle);
  await waitFor(() => expect(toggle).toBeChecked());
  expect(screen.getAllByRole("link", { name: "Messages" })).toHaveLength(2);
});
it.each([
  [false, true],
  [true, false],
  [true, true],
])(
  "shows a profile Message action only when viewer=%s and recipient=%s permit it",
  async (viewer, recipient) => {
    identity.preferences.messagingEnabled = viewer;
    render(
      view(
        <PrivateProfile
          data={{
            ...sampleProfile,
            profile: {
              ...sampleProfile.profile,
              id: "friend",
              name: "A friend",
              relationship: "friends",
              messagingEnabled: recipient,
            },
          }}
        />,
      ),
    );
    expect(screen.queryByRole("link", { name: "Message" }) !== null).toBe(
      viewer && recipient,
    );
  },
);
it("clears a stale open conversation after a server denial reports that messaging is off", async () => {
  const initial = structuredClone(identity);
  identity.preferences.messagingEnabled = false;
  request.mockImplementation(async (url) =>
    url === "/api/member/context"
      ? Response.json(identity)
      : url === "/api/notifications"
        ? Response.json({ activity: [], nextCursor: null })
        : Response.json({ error: "Messaging is off." }, { status: 403 }),
  );
  render(
    view(
      <MemberMessages
        initialThreads={[sampleConversation.thread]}
        initialConversation={sampleConversation}
        selectedId={sampleConversation.thread.id}
        referenceTime="2026-11-03T12:00:00Z"
      />,
      initial,
    ),
  );
  expect(
    await screen.findByRole("heading", { name: "Messaging is off." }),
  ).toBeVisible();
  expect(screen.queryByText("See you on Saturday.")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Send message" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Messaging settings" }),
  ).toHaveAttribute("href", "/app/settings#messaging-settings");
});
it("keeps Space post activity available when messaging is off and opens the scoped post", async () => {
  const user = userEvent.setup();
  identity.preferences.messagingEnabled = false;
  const href = "/app/spaces/room?post=post-one#post-one";
  request.mockImplementation(async (url) =>
    url === "/api/member/context"
      ? Response.json(identity)
      : Response.json({
          activity: [
            {
              id: "space-activity",
              actor: sampleConversation.thread.contact,
              kind: "space_post",
              spaceName: "Our Space",
              href,
              read: false,
              createdAt: "2026-11-03T12:00:00Z",
            },
            {
              id: "old-message",
              actor: sampleConversation.thread.contact,
              kind: "message",
              href: "/app/messages",
              read: false,
              createdAt: "2026-11-03T12:00:00Z",
            },
          ],
          nextCursor: null,
        }),
  );
  render(view(<MemberNotifications />));
  await user.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  expect(screen.queryByText(/sent you a message/)).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: /Alex Example posted in Our Space/ }),
  );
  expect(router.push).toHaveBeenCalledWith(href);
});
