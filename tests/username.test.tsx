import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import {
  changeLocalUsername,
  initialLocalState,
  searchProfiles,
} from "@/features/local-preview/model";
import { USERNAME_COOLDOWN_MS } from "@/features/profile/username";
import { UsernameSettings } from "@/features/settings/username-settings";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { previewBootstrap } from "./helpers/local-preview-fixture";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() =>
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
);
afterEach(() => vi.unstubAllGlobals());

it("changes only the viewer's search identifier while preserving IDs and relationships", () => {
  const data = previewBootstrap();
  const original = initialLocalState(data);
  const now = new Date(data.now);
  const changed = changeLocalUsername(
    original,
    data.viewerId,
    " @Ines_Science ",
    now,
  );
  expect(changed.profiles[0].handle).toBe("ines_science");
  expect(original.profiles[0].handle).toBe("ines");
  expect(changed.profiles[0].person).toEqual(original.profiles[0].person);
  expect(changed.profiles[1]).toEqual(original.profiles[1]);
  expect(changed.friendships).toEqual(original.friendships);
  expect(
    searchProfiles(changed.profiles, "@ines_science").map(
      (profile) => profile.person.id,
    ),
  ).toEqual(["ines"]);
  expect(() =>
    changeLocalUsername(changed, data.viewerId, "ines_again", now),
  ).toThrow(/again on/);
  const almost = new Date(now.getTime() + USERNAME_COOLDOWN_MS - 1);
  expect(() =>
    changeLocalUsername(changed, data.viewerId, "ines_again", almost),
  ).toThrow(/again on/);
  expect(
    changeLocalUsername(
      changed,
      data.viewerId,
      "ines_again",
      new Date(now.getTime() + USERNAME_COOLDOWN_MS),
    ).profiles[0].handle,
  ).toBe("ines_again");
});

it.each([
  "ThEo",
  "support",
  "ab",
  "a".repeat(25),
  "1ines",
  "inéś",
  "ines.name",
  "<script>",
  "ines",
])(
  "rejects unavailable or invalid username %s without changing state",
  (name) => {
    const data = previewBootstrap();
    const state = initialLocalState(data);
    expect(() =>
      changeLocalUsername(state, data.viewerId, name, new Date(data.now)),
    ).toThrow();
    expect(state.profiles[0].handle).toBe("ines");
    expect(state.usernameChangedAt).toBeUndefined();
  },
);

it("denies a missing viewer or invalid cooldown state", () => {
  const data = previewBootstrap();
  const state = initialLocalState(data);
  expect(() =>
    changeLocalUsername(state, "missing", "valid_name", new Date(data.now)),
  ).toThrow(/unavailable/);
  expect(() =>
    changeLocalUsername(
      { ...state, usernameChangedAt: "invalid" },
      data.viewerId,
      "valid_name",
      new Date(data.now),
    ),
  ).toThrow(/unavailable/);
});

it("requires confirmation, permits cancellation, updates the profile and then applies the cooldown", async () => {
  const user = userEvent.setup();
  const data = previewBootstrap();
  const { container } = render(
    <PreviewProvider bootstrap={data}>
      <UsernameSettings />
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Change username" }));
  const form = screen.getByRole("form", { name: "Change username" });
  const input = within(form).getByRole("textbox", { name: "New username" });
  expect(input).toHaveFocus();
  await user.clear(input);
  await user.type(input, "ThEo");
  await user.tab();
  expect(within(form).getByRole("alert")).toHaveTextContent(
    "That username isn’t available.",
  );
  expect(
    within(form).getByRole("button", { name: "Review change" }),
  ).toBeDisabled();
  await user.clear(input);
  await user.type(input, "Ines_Science");
  expect(within(form).getByRole("status")).toHaveTextContent(
    "@ines_science is available in this preview.",
  );
  const review = within(form).getByRole("button", { name: "Review change" });
  await user.click(review);
  let confirmation = screen.getByRole("alertdialog", {
    name: "Change username?",
  });
  expect(
    within(confirmation).getByRole("button", { name: "Cancel" }),
  ).toHaveFocus();
  expect(container.querySelector(".margin-profile-handle")).toHaveTextContent(
    "@ines",
  );
  await user.click(
    within(confirmation).getByRole("button", { name: "Cancel" }),
  );
  await waitFor(() => expect(review).toHaveFocus());
  expect(container.querySelector(".margin-profile-handle")).toHaveTextContent(
    "@ines",
  );
  await user.click(review);
  confirmation = screen.getByRole("alertdialog", { name: "Change username?" });
  await user.click(
    within(confirmation).getByRole("button", { name: "Confirm change" }),
  );
  expect(container.querySelector(".margin-profile-handle")).toHaveTextContent(
    "@ines_science",
  );
  expect(
    screen.queryByRole("form", { name: "Change username" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Change username" }),
  ).toBeDisabled();
  await waitFor(() =>
    expect(container.querySelector(".margin-username-current")).toHaveFocus(),
  );
  expect(
    screen.getByText(/You can change your username again on/),
  ).toBeVisible();
  expect(screen.getByText("Username changed to @ines_science.")).toBeVisible();
});
