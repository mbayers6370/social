import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { WelcomeCommitments } from "@/features/public-site/welcome-commitments";

it("reads each commitment once and styles the repeated row without adding controls", () => {
  const { container } = render(<WelcomeCommitments />);
  const list = screen.getByRole("list", { name: "What’s different" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(5);
  expect(screen.getAllByRole("listitem")).toHaveLength(5);
  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
    "margin-welcome-differences",
    "margin-welcome-differences-copy",
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
