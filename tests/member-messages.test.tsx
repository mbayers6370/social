import { beforeEach, afterEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemberMessages } from "@/features/social/member-messages";
import { MemberConversationExport } from "@/features/social/member-conversation-export";
import { SpaceClientProvider } from "@/features/spaces/client";
import { sampleConversation } from "@/features/social/member-preview";
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const request = vi.fn();
beforeEach(() => {
  request
    .mockReset()
    .mockImplementation(
      async () => new Response(JSON.stringify(sampleConversation)),
    );
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const client = {
  request,
  href: (url: string) => url,
  photoSrc: (id: string) => `/api/photos/${id}`,
  preview: false,
};
function view(selectedId?: string, empty = false) {
  return (
    <SpaceClientProvider client={client}>
      <MemberMessages
        initialThreads={empty ? [] : [sampleConversation.thread]}
        initialConversation={empty ? null : sampleConversation}
        selectedId={selectedId}
        referenceTime="2026-11-02T20:00:00Z"
      />
    </SpaceClientProvider>
  );
}
it("returns keyboard focus to the original mobile conversation trigger after Escape closes it", async () => {
  const user = userEvent.setup();
  const rendered = render(view());
  expect(
    screen.getByText("Messages expire 30 days after sending."),
  ).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Message history" }),
  ).toHaveAccessibleDescription("Messages expire 30 days after sending.");
  const retention = screen
    .getByText("Messages expire 30 days after sending.")
    .closest("p")!;
  expect(
    within(retention).getByRole("button", { name: "Export conversation" }),
  ).toBeVisible();
  const composer = screen.getByRole("textbox", {
    name: "Message to Alex Example",
  });
  expect(composer).toHaveAttribute("placeholder", "Write to Alex…");
  expect(document.querySelector('label[for="message-body"]')).toHaveClass(
    "sr-only",
  );
  const trigger = screen.getByRole("button", {
    name: "Open conversation with Alex Example",
  });
  await user.click(trigger);
  expect(router.push).toHaveBeenCalledWith(
    "/app/messages?thread=fictional-friend",
    { scroll: false },
  );
  rendered.rerender(view("fictional-friend"));
  expect(
    screen.getByRole("button", { name: "Back to messages" }),
  ).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(router.replace).toHaveBeenCalledWith("/app/messages", {
    scroll: false,
  });
  rendered.rerender(view());
  expect(trigger).toHaveFocus();
});
it("handles a removed original trigger without focusing a detached element", async () => {
  const rendered = render(view("fictional-friend"));
  const trigger = screen.getByRole("button", {
    name: "Open conversation with Alex Example",
  });
  rendered.rerender(view(undefined, true));
  expect(trigger.isConnected).toBe(false);
  expect(
    screen.getByRole("heading", { name: "Messages unavailable" }),
  ).toBeVisible();
  expect(document.activeElement).not.toBe(trigger);
});
it("clears messages and disables sending after a server permission denial", async () => {
  request.mockResolvedValue(
    new Response(JSON.stringify({ error: "Access changed" }), { status: 404 }),
  );
  render(view("fictional-friend"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Access changed"),
  );
  expect(
    screen.queryByRole("button", { name: "Send message" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Message history" }),
  ).not.toHaveTextContent("See you on Saturday.");
});

it("omits conversation options from Notebook while retaining its notes and composer", async () => {
  const notebook = {
    ...sampleConversation,
    thread: { ...sampleConversation.thread, notebook: true },
  };
  request.mockImplementation(async (url: string) =>
    Response.json(
      url === "/api/messages"
        ? { threads: [notebook.thread], nextCursor: null }
        : notebook,
    ),
  );
  render(
    <SpaceClientProvider client={client}>
      <MemberMessages
        initialThreads={[notebook.thread]}
        initialConversation={notebook}
        selectedId={notebook.thread.id}
        referenceTime="2026-11-02T20:00:00Z"
      />
    </SpaceClientProvider>,
  );
  expect(screen.getByRole("heading", { name: "Notebook" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Conversation options" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Notebook history" }),
  ).toBeVisible();
  expect(screen.getByText("Notes expire 90 days after saving.")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Export conversation" }),
  ).not.toBeInTheDocument();
});

it("exports through the existing endpoint and allows retry after an inline failure", async () => {
  const user = userEvent.setup();
  const createObjectURL = vi.fn(() => "blob:conversation-export");
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = vi.fn();
    },
  );
  const clicked = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  request
    .mockResolvedValueOnce(
      Response.json(
        { error: "Export temporarily unavailable." },
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({ messages: sampleConversation.messages }),
    );
  render(
    <SpaceClientProvider client={client}>
      <MemberConversationExport threadId="fictional-friend" />
    </SpaceClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Export conversation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Export temporarily unavailable.",
  );
  expect(createObjectURL).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Export conversation" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Your conversation download is ready.",
  );
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    "/api/messages/fictional-friend/export",
    "/api/messages/fictional-friend/export",
  ]);
  expect(clicked).toHaveBeenCalledOnce();
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
