import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfileContactActions } from "@/features/profile/profile-contact-actions";
import { ProfileIdentity } from "@/features/profile/profile-identity";
import { MarginNavigation } from "@/components/layout/margin-navigation";
import { notificationFixture } from "./helpers/notification-fixture";

let desktop = true;
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  desktop = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: desktop,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
function profile() {
  const { bootstrap } = notificationFixture();
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <ProfileContactActions person={bootstrap.profiles[1].person} />
    </PreviewProvider>,
  );
}

it("offers editing and settings on the owner's profile without self friendship controls", async () => {
  const user = userEvent.setup();
  const { bootstrap } = notificationFixture();
  const update = vi.fn();
  render(<ProfileIdentity profile={bootstrap.profiles[0]} onUpdate={update} />);
  const edit = screen.getByRole("button", { name: "Edit profile" });
  expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "href",
    "/?view=settings",
  );
  expect(
    screen.queryByRole("img", { name: /Friends with/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Friends" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Add friend|More options/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /Message Ines/ }),
  ).not.toBeInTheDocument();
  await user.click(edit);
  let form = screen.getByRole("form", { name: "Edit profile" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const name = within(form).getByRole("textbox", { name: "Name" });
  expect(name).toHaveValue("Ines");
  await waitFor(() => expect(name).toHaveFocus());
  await user.clear(name);
  await user.type(name, "Unsaved name");
  await user.click(within(form).getByRole("button", { name: "Cancel" }));
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ines");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus(),
  );
  await user.click(screen.getByRole("button", { name: "Edit profile" }));
  form = screen.getByRole("form", { name: "Edit profile" });
  const restoredName = within(form).getByRole("textbox", { name: "Name" });
  expect(restoredName).toHaveValue("Ines");
  await user.clear(restoredName);
  await user.click(within(form).getByRole("button", { name: "Save changes" }));
  expect(await within(form).findByRole("alert")).toHaveTextContent(
    "Enter a name.",
  );
  expect(update).not.toHaveBeenCalled();
  await user.type(restoredName, "Ines, locally");
  const bio = within(form).getByRole("textbox", { name: "Bio" });
  await user.clear(bio);
  await user.type(bio, "Walking slowly.");
  await user.click(within(form).getByRole("button", { name: "Save changes" }));
  expect(update).toHaveBeenCalledExactlyOnceWith({
    name: "Ines, locally",
    bio: "Walking slowly.",
  });
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Ines, locally",
  );
  await user.click(screen.getByRole("button", { name: "Edit profile" }));
  form = screen.getByRole("form", { name: "Edit profile" });
  expect(within(form).getByRole("textbox", { name: "Name" })).toHaveValue(
    "Ines, locally",
  );
  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("form", { name: "Edit profile" }),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus(),
  );
});

it("shows a two-person status and icon-only message, and moves unfriend feedback below the controls", async () => {
  const user = userEvent.setup();
  profile();
  const status = screen.getByRole("img", { name: "Friends with Theo" });
  expect(status.querySelector(".lucide-users")).toBeInTheDocument();
  expect(status.querySelector(".lucide-check")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Message Theo" })).toHaveAttribute(
    "href",
    "/?view=messages&thread=theo",
  );
  const more = screen.getByRole("button", { name: "More options for Theo" });
  await user.click(more);
  await user.click(screen.getByRole("menuitem", { name: "Unfriend" }));
  const confirmation = screen.getByRole("alertdialog", {
    name: "Unfriend Theo?",
  });
  await waitFor(() =>
    expect(
      within(confirmation).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus(),
  );
  await user.click(
    within(confirmation).getByRole("button", { name: "Unfriend" }),
  );
  expect(
    screen
      .getByRole("button", { name: "Add friend" })
      .querySelector(".lucide-user-plus"),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Message Theo" }),
  ).not.toBeInTheDocument();
  const feedback = screen.getByRole("status");
  expect(feedback).toHaveTextContent("Theo removed from friends.");
  expect(
    document.querySelector(".margin-profile-contact-actions"),
  ).not.toContainElement(feedback);
  await waitFor(() => expect(more).toHaveFocus());
});
it("supports standard desktop menu keys, dismissal, and focus handoff to a form", async () => {
  const user = userEvent.setup();
  profile();
  const more = screen.getByRole("button", { name: "More options for Theo" });
  more.focus();
  await user.keyboard("{ArrowDown}");
  await waitFor(() =>
    expect(screen.getByRole("menuitem", { name: "Unfriend" })).toHaveFocus(),
  );
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "Block profile" })).toHaveFocus();
  await user.keyboard("{End}");
  expect(screen.getByRole("menuitem", { name: "Help & safety" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(more).toHaveFocus();
  await user.click(more);
  await user.click(screen.getByRole("menuitem", { name: "Report profile" }));
  expect(screen.getByRole("dialog", { name: "Report Theo" })).toBeVisible();
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "Reason" })).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  await waitFor(() => expect(more).toHaveFocus());
});
it("uses a dismissible mobile action sheet with labeled choices and Cancel", async () => {
  desktop = false;
  const user = userEvent.setup();
  profile();
  const more = screen.getByRole("button", { name: "More options for Theo" });
  await user.click(more);
  const sheet = screen.getByRole("dialog", { name: "Profile options" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(within(sheet).getByRole("button", { name: "Unfriend" })).toBeVisible();
  expect(
    within(sheet).getByRole("button", { name: "Block profile" }),
  ).toBeVisible();
  await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(more).toHaveFocus());
});
it("mounts the hamburger navigation outside profile/card stacking contexts", async () => {
  const user = userEvent.setup();
  const { bootstrap } = notificationFixture();
  render(
    <PreviewProvider bootstrap={bootstrap}>
      <MarginNavigation profileAvatar={<span>IA</span>} />
      <section className="margin-profile-music">On Repeat</section>
    </PreviewProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Profile menu" });
  await user.click(trigger);
  const navigation = screen.getByRole("navigation", {
    name: "Profile menu",
  });
  expect(navigation.parentElement).toBe(document.body);
  await waitFor(() =>
    expect(
      within(navigation).getByRole("link", { name: "View profile" }),
    ).toHaveFocus(),
  );
  await user.keyboard("{Escape}");
  expect(
    screen.queryByRole("navigation", { name: "Profile menu" }),
  ).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
