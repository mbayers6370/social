import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WaitlistForm } from "@/features/public-site/waitlist-form";

it("keeps the email for retry after failure and confirms only a successful save", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Please try again." }), {
        status: 503,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ saved: true }), { status: 202 }),
    );
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<WaitlistForm />);
  await user.type(
    screen.getByLabelText("No invite yet? Leave your email."),
    "person@example.com",
  );
  await user.click(screen.getByRole("button", { name: "Join the waitlist" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again.",
  );
  expect(screen.getByRole("textbox")).toHaveValue("person@example.com");
  await user.click(screen.getByRole("button", { name: "Join the waitlist" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "You’re on the list.",
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/waitlist",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "person@example.com", consent: true }),
    }),
  );
  vi.unstubAllGlobals();
});
