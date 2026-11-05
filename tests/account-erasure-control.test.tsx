import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const boundary = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({ signOut: boundary.signOut }),
  useReverification: (fetcher: () => Promise<Response>) => fetcher,
}));
import { AccountErasureControl } from "@/features/account/account-erasure-control";
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  boundary.signOut.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
it("requires an explicit confirmation and lets cancellation leave account data untouched", async () => {
  const user = userEvent.setup();
  render(<AccountErasureControl />);
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("cannot be undone");
  expect(
    screen.getByRole("button", { name: "Delete my account" }),
  ).toBeDisabled();
  await user.type(screen.getByLabelText("Type DELETE to continue"), "delete");
  expect(
    screen.getByRole("button", { name: "Delete my account" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(boundary.signOut).not.toHaveBeenCalled();
});
it("keeps the confirmation recoverable on failure and signs out only after server acceptance", async () => {
  const user = userEvent.setup();
  render(<AccountErasureControl />);
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  await user.type(screen.getByLabelText("Type DELETE to continue"), "DELETE");
  fetcher.mockResolvedValueOnce(
    Response.json({ error: "Service unavailable" }, { status: 503 }),
  );
  await user.click(screen.getByRole("button", { name: "Delete my account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Service unavailable",
  );
  expect(boundary.signOut).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(
    Response.json({ accepted: true }, { status: 202 }),
  );
  await user.click(screen.getByRole("button", { name: "Delete my account" }));
  await screen.findByText("Your deletion request was accepted.");
  expect(boundary.signOut).toHaveBeenCalledWith({ redirectUrl: "/your-data" });
  expect(fetcher).toHaveBeenLastCalledWith(
    "/api/account/erasure",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
  );
});
