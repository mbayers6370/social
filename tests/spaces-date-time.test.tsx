import { useState } from "react";
import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventDateTimeField } from "@/features/spaces/event-date-time-field";
function Field({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <EventDateTimeField value={value} onChange={setValue} />;
}
it("chooses leap day with the keyboard, preserves time and returns focus to the calendar control", async () => {
  const user = userEvent.setup();
  render(<Field initial="2028-02-28T18:30" />);
  await user.click(screen.getByRole("button", { name: "Choose date" }));
  const calendar = screen.getByRole("dialog", { name: "Choose date" });
  expect(
    within(calendar).getByRole("button", { name: "Monday, February 28, 2028" }),
  ).toHaveFocus();
  await user.keyboard("{ArrowRight}{Enter}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Date", { exact: true })).toHaveValue(
    "2028-02-29",
  );
  expect(screen.getByLabelText("Time", { exact: true })).toHaveValue("18:30");
  expect(screen.getByRole("button", { name: "Choose date" })).toHaveFocus();
});
it("navigates months without changing the selected date and Escape discards that navigation", async () => {
  const user = userEvent.setup();
  render(<Field initial="2027-01-31T09:00" />);
  await user.click(screen.getByRole("button", { name: "Choose date" }));
  await user.keyboard("{PageDown}");
  expect(
    screen.getByRole("grid", { name: "February 2027" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Sunday, February 28, 2027" }),
  ).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.getByLabelText("Date", { exact: true })).toHaveValue(
    "2027-01-31",
  );
});
