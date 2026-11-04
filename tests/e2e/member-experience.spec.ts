import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture, conversation, friend } from "./helpers/member-fixture";
test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development-only rendering fixture",
  );
  await memberFixture(page);
});
test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
});
test("shows the approved profile, recovers a failed edit, and uses live music search", async ({
  page,
}, info) => {
  await page.goto("/preview/auth?view=member&area=profile");
  await expect(
    page.getByRole("heading", { name: "Sample Member", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recent Posts" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".margin-profile-gallery")
      .getByRole("link", { name: "View More" }),
  ).toHaveAttribute("href", "/app/gallery");
  await captureScreenshot(page, {
    caret: "initial",
    path: info.outputPath("member-profile.png"),
    fullPage: true,
  });
  let reject = true;
  const payloads: unknown[] = [];
  await page.route("**/__member_fixture/api/profiles/me", (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill(
      reject
        ? { status: 503, json: { error: "Profile service is unavailable" } }
        : { json: { saved: true } },
    );
  });
  const edit = page.getByRole("button", { name: "Edit profile", exact: true });
  await edit.click();
  await page.getByLabel("Name", { exact: true }).fill("Sample Saved");
  await page.getByLabel("Bio", { exact: true }).fill("A new introduction");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Profile service" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Sample Saved",
  );
  reject = false;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(edit).toBeFocused();
  expect(payloads).toEqual(
    Array(2).fill({ name: "Sample Saved", bio: "A new introduction" }),
  );
  const track = {
    id: "itunes-123",
    title: "Fictional song",
    artist: "Sample artist",
    source: "itunes",
    appleMusicUrl: "https://music.apple.com/us/album/sample/123?i=123",
    spotifyUrl: "https://open.spotify.com/search/Sample",
  };
  await page.route("**/__member_fixture/api/music?*", (route) =>
    route.fulfill({ json: { tracks: [track] } }),
  );
  await page.route("**/__member_fixture/api/music/selections", (route) =>
    route.fulfill({ json: { tracks: [track] } }),
  );
  await page.getByRole("button", { name: "Find Music", exact: true }).click();
  await page.getByLabel("Song or artist").fill("Sample artist");
  await page
    .getByRole("button", { name: "Add Fictional song by Sample artist" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "added to On Repeat" }),
  ).toBeVisible();
});
test("keeps Friends, Gallery, Settings and Spaces consistent with member navigation", async ({
  page,
}, info) => {
  for (const [area, title] of [
    ["friends", "Friends"],
    ["gallery", "Your Gallery"],
    ["settings", "Settings"],
    ["spaces", "Spaces"],
  ]) {
    await page.goto(`/preview/auth?view=member&area=${area}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await captureScreenshot(page, {
      caret: "initial",
      path: info.outputPath(`member-${area}.png`),
      fullPage: true,
    });
    if (area === "friends") {
      await expect(
        page.getByRole("link", { name: /Alex Example @alex_example/ }),
      ).toHaveAttribute("href", "/app?person=fictional-friend");
      await page.getByRole("tab", { name: "Requests" }).click();
      await expect(page.getByText("No requests right now.")).toBeVisible();
    }
    if (area === "settings") {
      await page.getByRole("radio", { name: "Larger", exact: true }).click();
      await expect(
        page.getByRole("radio", { name: "Larger", exact: true }),
      ).toBeChecked();
      await expect(page.locator("html")).toHaveAttribute(
        "data-reading-size",
        "larger",
      );
      await expect(
        page.getByRole("status").filter({ hasText: "Saved" }),
      ).toBeVisible();
    }
  }
});
test("restores conversation trigger focus on Escape and safely retries an uncertain delivery", async ({
  page,
}, info) => {
  let delivered = false;
  const payloads: { body: string; requestId: string }[] = [];
  await page.route(
    "**/__member_fixture/api/messages/fictional-friend",
    (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: conversation });
      payloads.push(route.request().postDataJSON());
      return route.fulfill(
        delivered
          ? { json: { id: "saved-message" } }
          : { status: 503, json: { error: "Delivery could not be confirmed" } },
      );
    },
  );
  await page.goto("/preview/auth?view=member&area=messages");
  const trigger = page.getByRole("button", {
    name: `Open conversation with ${friend.name}`,
  });
  await trigger.click();
  if (info.project.name === "mobile")
    await expect(
      page.getByRole("button", { name: "Back to messages" }),
    ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  const input = page.getByRole("textbox", { name: "Message to Alex Example" });
  await input.fill("A real draft");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Delivery could not be confirmed" }),
  ).toBeVisible();
  await expect(input).toHaveValue("A real draft");
  delivered = true;
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(input).toHaveValue("");
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toEqual(payloads[1]);
  expect(payloads[0].requestId).toMatch(/^[a-f0-9-]{36}$/);
  await captureScreenshot(page, {
    caret: "initial",
    path: info.outputPath("member-messages.png"),
    fullPage: true,
  });
});
test("clears stale conversation content when the server denies access", async ({
  page,
}) => {
  await page.route(
    "**/__member_fixture/api/messages/fictional-friend",
    (route) =>
      route.fulfill({
        status: 404,
        json: { error: "Conversation unavailable" },
      }),
  );
  await page.goto(
    "/preview/auth?view=member&area=messages&thread=fictional-friend",
  );
  await expect(
    page.getByText("Conversation unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Message history" })
      .getByText("See you on Saturday."),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Send message", exact: true }),
  ).toHaveCount(0);
});
