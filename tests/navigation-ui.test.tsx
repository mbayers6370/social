import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfileSearch } from "@/features/search/profile-search";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { SettingsPage } from "@/features/settings/settings-page";
import { MarginShell } from "@/components/layout/margin-shell";
import { MarginNavigation } from "@/components/layout/margin-navigation";
import { AccountSession } from "@/components/auth/account-session";
import { previewBootstrap as bootstrap } from "./helpers/local-preview-fixture";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => vi.unstubAllGlobals());

it("provides a desktop utility footer and grouped mobile utilities in Settings", () => {
  const { rerender } = render(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginShell profileAvatar={<span>IA</span>}>
        <h1>Feed</h1>
      </MarginShell>
    </PreviewProvider>,
  );
  expect(
    screen.getByRole("navigation", { name: "Footer" }),
  ).toBeInTheDocument();
  expect(screen.getByText("© 2026 margin").closest("footer")).toHaveClass(
    "margin-app-footer-desktop",
  );
  rerender(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginShell profileAvatar={<span>IA</span>}>
        <SettingsPage />
      </MarginShell>
    </PreviewProvider>,
  );
  const navigation = screen.getByRole("navigation", { name: "Help and legal" });
  expect(
    within(navigation).getByRole("link", { name: "Privacy" }),
  ).toHaveAttribute("href", "/privacy");
  expect(
    within(navigation).getByRole("link", { name: "Help & safety" }),
  ).toHaveAttribute("href", "/help");
  const copyright = within(navigation.closest("footer")!).getByText(
    "© 2026 margin",
  );
  expect(
    navigation.compareDocumentPosition(copyright) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    within(navigation).queryByRole("link", { name: "Coming soon" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeInTheDocument();
});

it("searches profiles by name and username with keyboard dismissal and focus restoration", async () => {
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <ProfileSearch />
    </PreviewProvider>,
  );
  const trigger = screen.getByRole("button", { name: "Search profiles" });
  await user.click(trigger);
  const input = screen.getByRole("searchbox", { name: "Name or username" });
  await user.type(input, "@THEO");
  expect(screen.getByRole("link", { name: /Theo Marchetti/ })).toHaveAttribute(
    "href",
    "/?view=profile&person=theo",
  );
  expect(screen.getByRole("status")).toHaveTextContent("1 profile found");
  await user.clear(input);
  await user.type(input, "no match");
  expect(
    screen.getByText("No profiles match. Try another name or username."),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("opens mobile account utilities, keeps the menu through viewport resize, and dismisses safely", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={bootstrap()}>
      <MarginNavigation profileAvatar={<span>IA</span>} />
    </PreviewProvider>,
  );
  const avatar = screen.getByRole("button", { name: "Profile menu" });
  await user.click(avatar);
  const menu = screen.getByRole("navigation", { name: "Profile menu" });
  await waitFor(() =>
    expect(
      within(menu).getByRole("link", { name: "View profile" }),
    ).toHaveFocus(),
  );
  for (const [name, href] of [
    ["Settings", "/?view=settings"],
    ["Help & safety", "/help"],
    ["Privacy", "/privacy"],
    ["Terms", "/terms"],
    ["Copyright", "/copyright"],
  ]) {
    expect(within(menu).getByRole("link", { name })).toHaveAttribute(
      "href",
      href,
    );
  }
  fireEvent(window, new Event("resize"));
  expect(menu).toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(avatar).toHaveFocus();
  expect(avatar).toHaveAttribute("aria-expanded", "false");
  await user.click(avatar);
  const privacy = screen.getByRole("link", { name: "Privacy" });
  // JSDOM cannot follow page links; keep the real disclosure click handler.
  privacy.addEventListener("click", (event) => event.preventDefault());
  await user.click(privacy);
  expect(screen.queryByRole("navigation", { name: "Profile menu" })).toBeNull();
});

it("switches exclusively between the desktop avatar menu and notifications, and opens profile editing", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const data = bootstrap();
  const user = userEvent.setup();
  render(
    <PreviewProvider bootstrap={data}>
      <MarginNavigation active="profile" profileAvatar={<span>IA</span>} />
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  const header = screen.getAllByRole("banner")[0];
  const avatar = within(header).getByRole("button", { name: "Profile menu" });
  const bell = within(header).getByRole("button", { name: /Notifications,/ });
  await user.click(avatar);
  let menu = screen.getByRole("navigation", { name: "Profile menu" });
  await waitFor(() =>
    expect(
      within(menu).getByRole("link", { name: "View profile" }),
    ).toHaveFocus(),
  );
  expect(
    within(menu).queryByRole("link", { name: "Feed" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("navigation", { name: "Primary" })).toHaveTextContent(
    "FeedMessages",
  );
  await user.click(bell);
  expect(screen.getByRole("dialog", { name: "Notifications" })).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: "Profile menu" }),
  ).not.toBeInTheDocument();
  await user.click(avatar);
  menu = screen.getByRole("navigation", { name: "Profile menu" });
  expect(
    screen.queryByRole("dialog", { name: "Notifications" }),
  ).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(avatar).toHaveFocus();
  await user.click(avatar);
  menu = screen.getByRole("navigation", { name: "Profile menu" });
  await user.click(within(menu).getByRole("button", { name: "Edit profile" }));
  const form = await screen.findByRole("form", { name: "Edit profile" });
  expect(within(form).getByRole("textbox", { name: "Name" })).toBeVisible();
  expect(
    screen.queryByRole("dialog", { name: "Edit profile" }),
  ).not.toBeInTheDocument();
  expect(push).toHaveBeenCalledWith("/?view=profile", { scroll: false });
  await user.click(within(form).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(avatar).toHaveFocus());
});

it("applies reading and motion settings across the local tab and restores them on unmount", async () => {
  const user = userEvent.setup();
  const { unmount } = render(
    <AccountSession enabled={false}>
      <PreviewProvider bootstrap={bootstrap()}>
        <SettingsPage />
      </PreviewProvider>
    </AccountSession>,
  );
  await user.click(screen.getByRole("radio", { name: "Larger" }));
  await user.click(screen.getByRole("radio", { name: "Reduce motion" }));
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "larger",
  );
  await user.click(screen.getByRole("radio", { name: "Larger" }));
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Extra large" })).toBeChecked();
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "extra-large",
  );
  expect(
    screen.getByRole("group", { name: "Text size preview" }),
  ).toBeVisible();
  await user.click(screen.getByRole("radio", { name: "Standard" }));
  expect(document.documentElement).toHaveAttribute(
    "data-reading-size",
    "standard",
  );
  expect(document.documentElement).toHaveAttribute("data-motion", "reduced");
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  expect(screen.getByRole("button", { name: "Exit preview" })).toBeVisible();
  unmount();
  expect(document.documentElement).not.toHaveAttribute("data-motion");
});

it("uses the mobile profile photograph, falling back to a circled icon on load failure", () => {
  const data = bootstrap();
  data.profiles[0].person.photo = data.photos[0].image;
  render(
    <PreviewProvider bootstrap={data}>
      <MarginNavigation profileAvatar={<span>IA</span>} />
    </PreviewProvider>,
  );
  const navigation = screen.getByRole("navigation", {
    name: "Mobile navigation",
  });
  const profile = within(navigation).getByRole("link", { name: "Profile" });
  const image = profile.querySelector("img")!;
  expect(image).toBeInTheDocument();
  const frame = image.parentElement!;
  expect(frame).toHaveStyle({
    borderRadius: "50%",
    overflow: "hidden",
    clipPath: "circle(50%)",
  });
  expect(image).toHaveStyle({
    objectPosition: "center",
    borderRadius: "50%",
    clipPath: "circle(50%)",
  });
  fireEvent.error(image);
  expect(profile.querySelector(".margin-mobile-profile-photo")).toBe(frame);
  expect(frame).toHaveStyle({ borderRadius: "50%", clipPath: "circle(50%)" });
  expect(profile.querySelector("img")).toBeNull();
  expect(
    profile.querySelector(".margin-mobile-profile-photo svg"),
  ).not.toBeNull();
});
