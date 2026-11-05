import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileLink } from "@/features/profile/profile-link";
afterEach(() => vi.useRealTimers());

it("clears copy confirmation after two seconds", async () => {
  userEvent.setup();
  vi.useFakeTimers();
  vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<ProfileLink username="matt" />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy profile link" }));
  });
  await act(async () => vi.advanceTimersByTime(1999));
  expect(screen.getByRole("status")).toHaveTextContent("Link copied.");
  await act(async () => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("copies the profile address on this site and confirms success", async () => {
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<ProfileLink username="Matt_B" />);
  await user.click(screen.getByRole("button", { name: "Copy profile link" }));
  expect(copy).toHaveBeenCalledWith(`${window.location.origin}/people/matt_b`);
  expect(screen.getByRole("status")).toHaveTextContent("Link copied.");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("offers a selectable link if clipboard access fails and lets the member retry", async () => {
  const user = userEvent.setup();
  const copy = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockRejectedValueOnce(Error("denied"))
    .mockResolvedValue();
  render(<ProfileLink username="matt" />);
  const button = screen.getByRole("button", { name: "Copy profile link" });
  await user.click(button);
  const input = screen.getByRole("textbox", {
    name: "Profile link",
  }) as HTMLInputElement;
  expect(input).toHaveValue(`${window.location.origin}/people/matt`);
  expect(input).toHaveAttribute("readonly");
  await user.click(input);
  expect(input.selectionEnd! - input.selectionStart!).toBe(input.value.length);
  await user.click(button);
  expect(copy).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status")).toHaveTextContent("Link copied.");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
