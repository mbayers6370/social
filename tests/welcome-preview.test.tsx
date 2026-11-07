import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PublicHome } from "@/features/public-site/public-home";

it("leads from the hero to the public messages preview without the removed feed demo", () => {
  render(<PublicHome />);
  expect(screen.queryByText("All caught up.")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("figure", { name: "Feed and conversation" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Flip the card" }),
  ).not.toBeInTheDocument();
  const hero = screen.getByRole("region", {
    name: "A feed that ends. Imagine.",
  });
  const messages = screen.getByRole("figure", {
    name: "Messages between friends",
  });
  const link = within(hero).getByRole("link", { name: "See how it feels" });
  expect(link).toHaveAttribute("href", `#${messages.id}`);
  expect(messages).toHaveAttribute("tabindex", "-1");
  expect(messages).toBeVisible();
  expect(
    within(messages).getByText("Coffee there this weekend?"),
  ).toBeVisible();
  expect(hero).not.toContainElement(messages);
  expect(
    messages.querySelectorAll("form, button, a, input, textarea"),
  ).toHaveLength(0);
  expect(screen.getByRole("heading", { name: "How it works" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Share a little." }),
  ).toBeVisible();
});
