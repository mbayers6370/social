import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { PreviewProvider } from "@/features/local-preview/provider";
import { MessagesPreview } from "@/features/messages/messages-preview";
import { notificationFixture } from "./helpers/notification-fixture";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
beforeEach(() => {
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
afterEach(() => vi.unstubAllGlobals());
const bootstrap = notificationFixture().bootstrap;
it("pins the notebook above newer and unread conversations, including after saving a note", async () => {
  const user = userEvent.setup();
  const [ines, theo] = bootstrap.profiles.map((profile) => profile.person);
  const threads = [
    {
      id: theo.id,
      contact: theo,
      unread: true,
      messages: [
        {
          id: "newer",
          body: "A newer conversation",
          direction: "incoming" as const,
          createdAt: "2026-10-29T20:00:00Z",
        },
      ],
    },
    { id: ines.id, contact: ines, unread: false, messages: [] },
  ];
  const app = render(
    <PreviewProvider bootstrap={bootstrap}>
      <MessagesPreview threads={threads} />
    </PreviewProvider>,
  );
  const first = () =>
    within(screen.getByRole("list", { name: "Conversations" })).getAllByRole(
      "listitem",
    )[0];
  expect(
    within(first()).getByRole("button", { name: "Open notebook" }),
  ).toBeInTheDocument();
  await user.type(
    screen.getByRole("textbox", { name: "Note to self" }),
    "Remember this thought",
  );
  await user.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() =>
    expect(
      within(first()).getByRole("button", { name: "Open notebook" }),
    ).toHaveTextContent("Remember this thought"),
  );
  app.rerender(
    <PreviewProvider bootstrap={bootstrap}>
      <MessagesPreview
        threads={[{ ...threads[0], unread: false }, threads[1]]}
      />
    </PreviewProvider>,
  );
  expect(
    within(first()).getByRole("button", { name: "Open notebook" }),
  ).toBeInTheDocument();
  expect(threads[0].contact.id).toBe(theo.id);
});
function RouteHarness() {
  const [onProfile, setOnProfile] = useState(false);
  const [personId, setPersonId] = useState("theo");
  const person = bootstrap.profiles.find(
    (profile) => profile.person.id === personId,
  )!.person;
  return (
    <>
      <button onClick={() => setOnProfile((value) => !value)}>
        {onProfile ? "Return to messages" : "Visit profile"}
      </button>
      <button
        onClick={() =>
          setPersonId((value) => (value === "theo" ? "ines" : "theo"))
        }
      >
        Switch contact
      </button>
      {onProfile ? (
        <h1>Profile</h1>
      ) : (
        <MessagesPreview
          threads={[
            { id: person.id, contact: person, unread: false, messages: [] },
          ]}
        />
      )}
    </>
  );
}
function openApp() {
  return render(
    <PreviewProvider bootstrap={bootstrap}>
      <RouteHarness />
    </PreviewProvider>,
  );
}

it("keeps separate drafts across leaving Messages and clears only the submitted draft", async () => {
  const user = userEvent.setup();
  const storage = vi.spyOn(Storage.prototype, "setItem");
  openApp();
  await user.type(
    screen.getByRole("textbox", { name: "Message to Theo" }),
    "A thought for Theo",
  );
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  await user.type(
    screen.getByRole("textbox", { name: "Note to self" }),
    "A separate thought",
  );
  await user.click(screen.getByRole("button", { name: "Visit profile" }));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Return to messages" }));
  expect(screen.getByRole("textbox", { name: "Note to self" })).toHaveValue(
    "A separate thought",
  );
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  expect(screen.getByRole("textbox", { name: "Message to Theo" })).toHaveValue(
    "A thought for Theo",
  );
  await user.click(
    screen.getByRole("button", { name: "Add message to local preview" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Message to Theo" }),
    ).toHaveValue(""),
  );
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  expect(screen.getByRole("textbox", { name: "Note to self" })).toHaveValue(
    "A separate thought",
  );
  await user.click(screen.getByRole("button", { name: "Visit profile" }));
  await user.click(screen.getByRole("button", { name: "Return to messages" }));
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  expect(screen.getByRole("textbox", { name: "Message to Theo" })).toHaveValue(
    "",
  );
  expect(
    screen.getByRole("list", { name: "Messages with Theo" }),
  ).toHaveTextContent("A thought for Theo");
  expect(storage).not.toHaveBeenCalled();
});
it("starts with empty drafts when the tab-level provider is recreated", async () => {
  const user = userEvent.setup();
  const app = openApp();
  await user.type(
    screen.getByRole("textbox", { name: "Message to Theo" }),
    "Not saved to disk",
  );
  app.unmount();
  openApp();
  expect(screen.getByRole("textbox", { name: "Message to Theo" })).toHaveValue(
    "",
  );
});
it("saves self notes as one-way notebook entries across navigation, isolates them from friends and clears them on refresh", async () => {
  const user = userEvent.setup();
  const storage = vi.spyOn(Storage.prototype, "setItem");
  const app = openApp();
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  const notebook = screen.getByRole("region", { name: "Notebook" });
  expect(
    within(notebook).getByRole("heading", { name: "Notebook" }),
  ).toBeInTheDocument();
  expect(
    within(notebook).queryByRole("link", { name: "View profile" }),
  ).not.toBeInTheDocument();
  expect(
    within(notebook).queryByRole("button", { name: "Export conversation" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Save note" }));
  expect(await within(notebook).findByRole("alert")).toHaveTextContent(
    "Write a note first.",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Note to self" }),
    "Remember the camera",
  );
  await user.click(screen.getByRole("button", { name: "Save note" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Note to self" })).toHaveValue(
      "",
    ),
  );
  const entries = within(notebook).getByRole("list", {
    name: "Notebook entries",
  });
  expect(within(entries).getAllByRole("listitem")).toHaveLength(1);
  expect(within(entries).getByRole("listitem")).toHaveAttribute(
    "data-direction",
    "outgoing",
  );
  expect(entries).toHaveTextContent("Remember the camera");
  expect(
    screen.getByRole("button", { name: "Open notebook" }),
  ).toHaveTextContent("Remember the camera");
  await user.click(screen.getByRole("button", { name: "Visit profile" }));
  await user.click(screen.getByRole("button", { name: "Return to messages" }));
  expect(
    screen.getByRole("list", { name: "Notebook entries" }),
  ).toHaveTextContent("Remember the camera");
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  expect(
    screen.getByRole("list", { name: "Messages with Theo" }),
  ).not.toHaveTextContent("Remember the camera");
  expect(storage).not.toHaveBeenCalled();
  app.unmount();
  openApp();
  await user.click(screen.getByRole("button", { name: "Switch contact" }));
  expect(
    screen.getByRole("list", { name: "Notebook entries" }),
  ).toBeEmptyDOMElement();
});
it("keeps preview limits in an optional dialog and restores focus to the notice", async () => {
  const user = userEvent.setup();
  openApp();
  const inbox = screen.getByRole("complementary", { name: "Messages" });
  const notice = within(inbox).getByRole("button", {
    name: "About this preview",
  });
  expect(
    screen.queryByText(/Automatic deletion and conversation exports/),
  ).not.toBeInTheDocument();
  expect(
    document.querySelector(".margin-message-disclaimer"),
  ).not.toBeInTheDocument();
  await user.click(notice);
  const details = screen.getByRole("dialog", { name: "About this preview" });
  expect(details).toHaveTextContent("Nothing is sent to another person.");
  expect(details).toHaveTextContent("Refreshing clears them.");
  expect(details).toHaveTextContent("Automatic deletion is not connected yet.");
  await user.keyboard("{Escape}");
  await waitFor(() => expect(notice).toHaveFocus());
});
