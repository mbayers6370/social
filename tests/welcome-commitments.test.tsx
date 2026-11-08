import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WelcomeCommitments } from "@/features/public-site/welcome-commitments";

it("reads each commitment once in the existing keyboard-scrollable row without adding controls", () => {
  render(<WelcomeCommitments />);
  const list = screen.getByRole("list", { name: "What’s different" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(
    screen.getByRole("region", { name: "Margin commitments" }),
  ).toHaveAttribute("tabindex", "0");
  expect(list).toHaveClass("margin-welcome-differences");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
