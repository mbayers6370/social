import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PreviewProvider } from "@/features/local-preview/provider";
import { ProfilePreview } from "@/features/profile/profile-preview";
import { OnRepeat } from "@/features/profile/on-repeat";
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

it("shows On Repeat above Gallery and lets the owner replace or remove their single song", async () => {
  const consoleError = vi.spyOn(console, "error");
  const user = userEvent.setup();
  const data = bootstrap();
  const catalogue = ["Anchor", "Holocene", "Youth", "Winter"].map(
    (title, index) => ({
      id: `itunes-${123 + index}`,
      title,
      artist: index === 0 ? "Novo Amor" : "Sample artist",
      artwork: data.photos[0].image,
    }),
  );
  data.profiles[0].onRepeat = catalogue.slice(0, 1);
  let saved = [...data.profiles[0].onRepeat!];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost:3000");
    if (init?.method === "POST") {
      const { action, trackId } = JSON.parse(String(init.body));
      saved =
        action === "remove"
          ? saved.filter((track) => track.id !== trackId)
          : [catalogue.find((track) => track.id === trackId)!];
      return Response.json({ tracks: saved });
    }
    const term = url.searchParams.get("q")!.toLowerCase();
    return Response.json({
      tracks: catalogue.filter((track) =>
        `${track.title} ${track.artist}`.toLowerCase().includes(term),
      ),
    });
  });
  render(
    <PreviewProvider bootstrap={data}>
      <ProfilePreview profile={data.profiles[0]} />
    </PreviewProvider>,
  );
  const music = screen.getByRole("region", { name: "On Repeat" });
  const gallery = screen.getByRole("region", { name: "Gallery" });
  expect(
    music.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(within(music).getAllByRole("listitem")).toHaveLength(1);
  const trigger = within(music).getByRole("button", { name: "Find Music" });
  await user.click(trigger);
  const picker = screen.getByRole("dialog", { name: "Find Music" });
  const search = within(picker).getByRole("searchbox", {
    name: "Song or artist",
  });
  await user.type(search, "Winter");
  await user.click(
    await within(picker).findByRole("button", {
      name: "Add Winter by Sample artist",
    }),
  );
  const remove = await within(picker).findByRole("button", {
    name: "Remove Winter from On Repeat",
  });
  expect(
    within(picker).queryByRole("button", {
      name: "Remove Anchor from On Repeat",
    }),
  ).not.toBeInTheDocument();
  await user.click(remove);
  await user.click(
    await within(picker).findByRole("button", {
      name: "Add Winter by Sample artist",
    }),
  );
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(within(music).getByText("Winter")).toBeVisible();
  expect(within(music).queryByText("Anchor")).not.toBeInTheDocument();
  expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
    "Encountered two children with the same key",
  );
});

it("lets a profile visitor open the whole song row by keyboard or pointer and restores focus", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  const tracks = [
    {
      id: "anchor",
      title: "Anchor",
      artist: "Novo Amor",
      artwork: data.photos[0].image,
      appleMusicUrl:
        "https://music.apple.com/us/album/anchor/1672226910?i=1672227410",
      spotifyUrl: "https://open.spotify.com/track/7qH9Z4dJEN0l9bidizW7fq",
    },
  ];
  render(
    <PreviewProvider bootstrap={data}>
      <OnRepeat tracks={tracks} own={false} />
    </PreviewProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Find Music" }),
  ).not.toBeInTheDocument();
  const row = screen.getByRole("button", { name: "Open Anchor by Novo Amor" });
  row.focus();
  await user.keyboard("{Enter}");
  const modal = screen.getByRole("dialog", { name: "Anchor" });
  expect(modal).toHaveAccessibleDescription("Novo Amor");
  for (const [service, href] of [
    ["Apple Music", tracks[0].appleMusicUrl],
    ["Spotify", tracks[0].spotifyUrl],
  ]) {
    const link = within(modal).getByRole("link", {
      name: `Open in ${service} (opens in a new tab)`,
    });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
  }
  await user.keyboard("{Escape}");
  expect(row).toHaveFocus();
  await user.click(row.querySelector("img")!);
  expect(screen.getByRole("dialog", { name: "Anchor" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(row).toHaveFocus();
});

it("does not render unsafe song links and keeps the modal dismissible when links are missing", async () => {
  const user = userEvent.setup();
  const data = bootstrap();
  render(
    <PreviewProvider bootstrap={data}>
      <OnRepeat
        own={false}
        tracks={[
          {
            id: "unavailable",
            title: "Unavailable",
            artist: "Sample",
            artwork: data.photos[0].image,
            appleMusicUrl: "javascript:alert(1)",
            spotifyUrl:
              "https://open.spotify.com.evil.example/track/7qH9Z4dJEN0l9bidizW7fq",
          },
        ]}
      />
    </PreviewProvider>,
  );
  await user.click(
    screen.getByRole("button", { name: "Open Unavailable by Sample" }),
  );
  const modal = screen.getByRole("dialog", { name: "Unavailable" });
  expect(within(modal).queryByRole("link")).not.toBeInTheDocument();
  expect(
    within(modal).getByText(
      "Listening links aren’t available for this song yet.",
    ),
  ).toBeVisible();
  await user.keyboard("{Escape}");
  expect(
    screen.getByRole("button", { name: "Open Unavailable by Sample" }),
  ).toHaveFocus();
});
