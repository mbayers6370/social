import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonalComposer } from "@/features/social/personal-composer";
import { SpaceClientProvider } from "@/features/spaces/client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const request = vi.fn<typeof fetch>();
const client = {
  request,
  href: (url: string) => url,
  photoSrc: (id: string) => `/api/photos/${id}`,
  preview: false,
};
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());
function view() {
  return (
    <SpaceClientProvider client={client}>
      <PersonalComposer viewer={{ id: "member", name: "A Member" }} />
    </SpaceClientProvider>
  );
}

it("keeps empty publishing disabled and refreshes the real count and Link availability after publishing", async () => {
  const user = userEvent.setup();
  let remaining = 3;
  request.mockImplementation(async (url) => {
    if (url === "/api/posts/allowance")
      return Response.json({
        regularRemaining: remaining,
        linkAllowed: remaining === 3,
      });
    remaining--;
    return Response.json({ id: "published" });
  });
  render(view());
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  expect(await screen.findByText("3 left today")).toBeVisible();
  const publish = screen.getByRole("button", { name: "Publish" });
  expect(publish).toBeDisabled();
  expect(screen.getByText("Up to 3 photographs")).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Your post" }),
  ).not.toBeInTheDocument();
  const input = screen.getByRole("textbox", { name: "Your post" });
  await user.type(input, "   ");
  expect(publish).toBeDisabled();
  await user.type(input, "A thought");
  expect(publish).toBeEnabled();
  await user.click(publish);
  await user.click(
    await screen.findByRole("button", { name: "Share a thought…" }),
  );
  expect(await screen.findByText("2 left today")).toBeVisible();
  const link = screen.getByRole("button", { name: "Link" });
  expect(link).toBeDisabled();
  expect(link).toHaveAccessibleDescription(
    "You’ve posted today, so links open again tomorrow.",
  );
});

it("shows the one-post link rule and requires both a thought and a link", async () => {
  const user = userEvent.setup();
  request.mockResolvedValue(
    Response.json({ regularRemaining: 3, linkAllowed: true }),
  );
  render(view());
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  await screen.findByText("3 left today");
  await user.click(screen.getByRole("button", { name: "Link" }));
  expect(screen.getByText("Your only post today")).toBeVisible();
  const publish = screen.getByRole("button", { name: "Publish" });
  await user.type(
    screen.getByRole("textbox", { name: "Your post" }),
    "Worth reading",
  );
  expect(publish).toBeDisabled();
  await user.type(
    screen.getByRole("textbox", { name: "Link" }),
    "https://example.com",
  );
  expect(publish).toBeEnabled();
});

it("keeps publishing unavailable after an allowance failure and recovers on explicit retry", async () => {
  const user = userEvent.setup();
  request
    .mockResolvedValueOnce(
      Response.json({ error: "Allowance unavailable" }, { status: 503 }),
    )
    .mockResolvedValueOnce(
      Response.json({ regularRemaining: 2, linkAllowed: false }),
    );
  render(view());
  await user.click(screen.getByRole("button", { name: "Share a thought…" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Allowance unavailable",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Your post" }),
    "Keep this draft",
  );
  expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Retry allowance" }));
  expect(await screen.findByText("2 left today")).toBeVisible();
  expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  expect(screen.getByRole("textbox", { name: "Your post" })).toHaveValue(
    "Keep this draft",
  );
});
