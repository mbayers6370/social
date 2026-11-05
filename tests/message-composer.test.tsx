import { useState } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { MessageComposer } from "@/features/messages/message-composer";
import { MessageLog } from "@/features/messages/message-log";
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
function Composer({
  onSend,
}: {
  onSend: (body: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  return (
    <MessageComposer
      live
      name="Matt B"
      draft={draft}
      onDraft={setDraft}
      onSend={onSend}
    />
  );
}
it("sends with Enter and leaves Shift+Enter as a new line", async () => {
  const user = userEvent.setup();
  const send = vi.fn();
  render(<Composer onSend={send} />);
  const input = screen.getByRole("textbox", { name: "Message to Matt B" });
  expect(input).toHaveAttribute("placeholder", "Write to Matt…");
  expect(
    screen.getByText("Enter to send · Shift+Enter for a new line"),
  ).toBeVisible();
  await user.type(input, "First line");
  await user.keyboard("{Shift>}{Enter}{/Shift}Second line");
  expect(input).toHaveValue("First line\nSecond line");
  expect(send).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(send).toHaveBeenCalledExactlyOnceWith("First line\nSecond line"),
  );
  expect(input).toHaveValue("");
});
it("does not submit an Enter used by an input method or held-down key", async () => {
  const user = userEvent.setup();
  const send = vi.fn();
  render(<Composer onSend={send} />);
  const input = screen.getByRole("textbox");
  await user.type(input, "A draft");
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
  fireEvent.keyDown(input, { key: "Enter", repeat: true });
  expect(send).not.toHaveBeenCalled();
  expect(input).toHaveValue("A draft");
});
it("keeps the draft when an Enter submission fails", async () => {
  const user = userEvent.setup();
  render(
    <Composer
      onSend={async () => {
        throw Error("Delivery failed. Your draft is kept.");
      }}
    />,
  );
  const input = screen.getByRole("textbox");
  await user.type(input, "Keep this thought{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("Delivery failed");
  expect(input).toHaveValue("Keep this thought");
});
it("shows one saved-date and 90-day expiry header for same-day notebook notes", () => {
  render(
    <MessageLog
      notebook
      name="Matt"
      referenceTime="2026-11-04T20:00:00Z"
      messages={[
        {
          id: "one",
          body: "First thought",
          direction: "outgoing",
          createdAt: "2026-11-04T20:00:00Z",
        },
        {
          id: "two",
          body: "Another thought",
          direction: "outgoing",
          createdAt: "2026-11-04T20:05:00Z",
        },
      ]}
    />,
  );
  const entries = within(
    screen.getByRole("list", { name: "Notebook entries" }),
  ).getAllByRole("listitem");
  for (const entry of entries) {
    expect(entry).not.toHaveAttribute("data-direction");
    expect(entry.querySelector(".margin-message-bubble")).toBeNull();
  }
  expect(entries[0].firstElementChild).toHaveTextContent(
    "4 Nov 2026 // expires 2 Feb",
  );
  expect(entries[1].querySelector(".margin-notebook-meta")).toBeNull();
  expect(entries[1]).toHaveTextContent("Another thought");
  expect(
    entries[0].querySelector(".margin-notebook-expiry time"),
  ).toHaveAttribute("dateTime", "2027-02-02T20:00:00.000Z");
});
it("separates notebook days rather than individual notes, using the displayed local day", () => {
  render(
    <MessageLog
      notebook
      name="Matt"
      referenceTime="2026-11-05T20:00:00Z"
      messages={[
        {
          id: "one",
          body: "Afternoon",
          direction: "outgoing",
          createdAt: "2026-11-04T20:00:00Z",
        },
        {
          id: "two",
          body: "Same local day",
          direction: "outgoing",
          createdAt: "2026-11-05T00:05:00Z",
        },
        {
          id: "three",
          body: "Next local day",
          direction: "outgoing",
          createdAt: "2026-11-05T08:05:00Z",
        },
      ]}
    />,
  );
  const entries = within(
    screen.getByRole("list", { name: "Notebook entries" }),
  ).getAllByRole("listitem");
  expect(entries[0]).not.toHaveAttribute("data-day-start");
  expect(entries[1]).not.toHaveAttribute("data-day-start");
  expect(entries[2]).toHaveAttribute("data-day-start", "true");
  expect(entries[0].querySelector(".margin-notebook-date")).toHaveTextContent(
    "4 Nov 2026",
  );
  expect(entries[1].querySelector(".margin-notebook-date")).toBeNull();
  expect(entries[2].querySelector(".margin-notebook-date")).toHaveTextContent(
    "5 Nov 2026",
  );
});
