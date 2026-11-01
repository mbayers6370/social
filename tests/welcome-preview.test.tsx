import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { PublicHome } from "@/features/public-site/public-home";

it("shows the connected friendship story and opens only its fictional discussion", async () => {
  const user = userEvent.setup();
  const { container } = render(<PublicHome />);
  expect(
    screen.getByRole("link", { name: "See how it feels" }),
  ).toHaveAttribute("href", "#welcome-preview");
  expect(container.querySelector("#welcome-preview")).toBeInTheDocument();
  const feed = screen.getByRole("figure", {
    name: "Feed and conversation",
  });
  const messages = screen.getByRole("figure", {
    name: "Messages between friends",
  });
  expect(feed).toBeVisible();
  expect(messages).toBeVisible();
  expect(
    within(messages).getByText("Coffee there this weekend?"),
  ).toBeVisible();
  const open = within(feed).getByRole("button", {
    name: "Open conversation",
  });
  expect(open).toHaveAttribute("aria-expanded", "false");
  expect(
    within(feed).queryByRole("region", {
      name: "Conversation between friends",
    }),
  ).not.toBeInTheDocument();
  await user.click(open);
  expect(open).toHaveAttribute("aria-expanded", "true");
  expect(
    within(feed).getByText("This looks lovely. Where is it?"),
  ).toBeVisible();
  expect(within(feed).getByText("That’s everything for now.")).toBeVisible();
  await user.click(
    within(feed).getByRole("button", { name: "Close conversation" }),
  );
  expect(open).toHaveAttribute("aria-expanded", "false");
  expect(
    within(feed).queryByRole("region", {
      name: "Conversation between friends",
    }),
  ).not.toBeInTheDocument();
  expect(container.querySelectorAll("form, input, textarea")).toHaveLength(0);
});
