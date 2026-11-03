import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  TimeZonePicker,
  preserveTimeZoneMenu,
} from "@/features/spaces/time-zone-picker";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const original = HTMLElement.prototype.scrollIntoView;
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = original;
});
function Picker() {
  const [value, setValue] = useState("America/Los_Angeles");
  return (
    <>
      <label htmlFor="zone">Time zone</label>
      <TimeZonePicker id="zone" value={value} onChange={setValue} />
      <output data-testid="zone">{value}</output>
    </>
  );
}
it("searches city names and selects the actual IANA zone with the keyboard", async () => {
  const user = userEvent.setup();
  render(<Picker />);
  const combo = screen.getByRole("combobox", { name: "Time zone" });
  await user.tab();
  await user.keyboard("Tokyo");
  expect(
    screen.getByRole("option", { name: "Asia / Tokyo" }),
  ).toBeInTheDocument();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(screen.getByTestId("zone")).toHaveTextContent("Asia/Tokyo");
  expect(combo).toHaveValue("Asia / Tokyo");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
it("Escape closes the dropdown before dismissing the containing dialog and never commits an unmatched search", async () => {
  function Modal() {
    const [open, setOpen] = useState(true);
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent onEscapeKeyDown={preserveTimeZoneMenu}>
          <DialogTitle>Event settings</DialogTitle>
          <DialogDescription>Choose a time zone.</DialogDescription>
          <Picker />
        </DialogContent>
      </Dialog>
    );
  }
  const user = userEvent.setup();
  render(<Modal />);
  const combo = screen.getByRole("combobox", { name: "Time zone" });
  await user.click(combo);
  await user.type(combo, "not a time zone");
  expect(screen.getByText("No time zones found.")).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByTestId("zone")).toHaveTextContent("America/Los_Angeles");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
