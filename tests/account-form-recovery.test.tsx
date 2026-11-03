import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { OnboardingForm } from "@/features/account/onboarding-form";
import {
  InvitationLanding,
  InvitationClaim,
} from "@/features/account/invitation-landing";
import { afterEach } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
it.each([false, true])(
  "preserves onboarding inputs after an application or transport failure (transport=%s)",
  async (transport) => {
    const user = userEvent.setup();
    const save = vi.fn(async () => {
      if (transport) throw Error("PRIVATE_FAILURE_CANARY");
      return { error: "That username is unavailable." };
    });
    render(<OnboardingForm managed saveAction={save} />);
    await user.type(screen.getByLabelText("Your name"), "Member Name");
    await user.type(screen.getByLabelText("Username"), "member_name");
    await user.type(
      screen.getByLabelText("A little about you (optional)"),
      "My introduction",
    );
    await user.click(
      screen.getByRole("checkbox", { name: "I am 18 or older." }),
    );
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Your name")).toHaveValue("Member Name");
    expect(screen.getByLabelText("Username")).toHaveValue("member_name");
    expect(screen.getByLabelText("A little about you (optional)")).toHaveValue(
      "My introduction",
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("alert")).not.toHaveTextContent("CANARY");
  },
);
it("retains the recipient email after a failed send and supports retry", async () => {
  const user = userEvent.setup();
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ error: "Please try again later." }, { status: 503 }),
    )
    .mockResolvedValueOnce(
      Response.json({ message: "Check your inbox." }, { status: 202 }),
    );
  vi.stubGlobal("fetch", fetch);
  render(<InvitationLanding token={"a".repeat(43)} />);
  await user.type(
    screen.getByLabelText("Your email address"),
    "friend@example.test",
  );
  await user.click(screen.getByRole("button", { name: "Email my invitation" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("try again");
  expect(screen.getByLabelText("Your email address")).toHaveValue(
    "friend@example.test",
  );
  await user.click(screen.getByRole("button", { name: "Email my invitation" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Check your inbox",
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("offers a retry when the personal invitation cannot be verified", async () => {
  const user = userEvent.setup();
  render(
    <InvitationClaim
      token={"a".repeat(43)}
      ticket="ticket"
      accept={async () => ({ error: "Please try again later." })}
    />,
  );
  await user.click(
    screen.getByRole("button", { name: "Continue to account setup" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("try again"),
  );
  expect(screen.getByRole("button")).toBeEnabled();
});

it("lets a recipient correct an address without sending again until they choose to", async () => {
  const user = userEvent.setup();
  const request = vi
    .fn()
    .mockResolvedValue(
      Response.json({ message: "Check your inbox." }, { status: 202 }),
    );
  vi.stubGlobal("fetch", request);
  render(<InvitationLanding token={"a".repeat(43)} />);
  await user.type(
    screen.getByLabelText("Your email address"),
    "typo@example.test",
  );
  await user.click(screen.getByRole("button", { name: "Email my invitation" }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "typo@example.test",
  );
  await user.click(
    screen.getByRole("button", { name: "Use a different email" }),
  );
  const email = screen.getByLabelText("Your email address");
  expect(email).toHaveValue("typo@example.test");
  expect(email).toHaveFocus();
  expect(request).toHaveBeenCalledTimes(1);
  await user.clear(email);
  await user.type(email, "correct@example.test");
  await user.click(screen.getByRole("button", { name: "Email my invitation" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    email: "correct@example.test",
  });
});
it("offers support when a legacy saved account cannot be activated", async () => {
  const user = userEvent.setup();
  render(
    <OnboardingForm
      managed
      saveAction={async () => ({ error: "", saved: true })}
    />,
  );
  await user.type(screen.getByLabelText("Your name"), "Member Name");
  await user.type(screen.getByLabelText("Username"), "member_name");
  await user.click(screen.getByRole("checkbox", { name: "I am 18 or older." }));
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByRole("heading", { name: "Your profile is ready." });
  expect(screen.getByText(/account setup needs attention/)).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Continue to your account" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute(
    "href",
    "mailto:support@margin.social",
  );
  expect(
    screen.queryByRole("button", { name: "Check approval status" }),
  ).not.toBeInTheDocument();
});
