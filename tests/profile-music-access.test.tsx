import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { OnRepeat } from "@/features/profile/on-repeat";
import { PreviewProvider } from "@/features/local-preview/provider";
import { previewBootstrap } from "./helpers/local-preview-fixture";

it("uses the required local access marker for profile music search and selection", async () => {
  const user = userEvent.setup();
  const data = previewBootstrap();
  const track = {
    id: "itunes-123",
    title: "Anchor",
    artist: "Novo Amor",
    artwork: data.photos[0].image,
  };
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_url, init) => {
      if (new Headers(init?.headers).get("x-margin-preview") !== "1")
        return Response.json({ error: "Request not allowed" }, { status: 403 });
      return Response.json({ tracks: [track] });
    });
  render(
    <PreviewProvider bootstrap={data}>
      <OnRepeat own tracks={[]} />
    </PreviewProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Find Music" }));
  const dialog = screen.getByRole("dialog", { name: "Find Music" });
  await user.type(
    within(dialog).getByRole("searchbox", { name: "Song or artist" }),
    "Anchor",
  );
  await user.click(
    await within(dialog).findByRole("button", {
      name: "Add Anchor by Novo Amor",
    }),
  );
  expect(
    await within(dialog).findByText("Anchor added to On Repeat."),
  ).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(
    "/api/development/music/selections",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "add", trackId: "itunes-123" }),
    }),
  );
  expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
});
