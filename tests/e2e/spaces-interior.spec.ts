import { test, expect, type Page } from "./fixtures";
import { calvinEvent } from "../helpers/ticketmaster-fixture";

// Exercise the Space UI without making any requests to the Ticketmaster API or image host.
const event = {
  ...calvinEvent,
  imageUrl: null,
};
test.beforeEach(async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local Space interior");
  await page.route("**/api/development/events?*", (route) =>
    route.fulfill({
      json: new URL(route.request().url()).searchParams.has("id")
        ? { event }
        : { events: [event], nextPage: null },
    }),
  );
  await page.goto("/preview/spaces");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
});

async function checkComposerPlacement(page: Page) {
  const composer = page.locator(".margin-space-composer");
  await expect(composer).toBeVisible();
  const composerBox = await composer.boundingBox();
  const content = page.getByRole("article").first();
  const contentBox = await content.boundingBox();
  expect(composerBox!.y + composerBox!.height).toBeLessThan(contentBox!.y);
  expect(composerBox!.x).toBeCloseTo(contentBox!.x, 0);
  expect(composerBox!.width).toBeCloseTo(contentBox!.width, 0);
  const members = page.locator(".margin-space-members");
  const options = page.locator(".margin-space-options");
  for (const card of [members, options]) {
    await expect(card).toHaveCSS("border-top-width", "1px");
    await expect(card).toHaveCSS("border-radius", "14px");
    await expect(card.locator(":scope > summary")).toHaveCSS(
      "min-height",
      "56px",
    );
  }
}

test("keeps Gathering RSVP responses in the sidebar and Share directly above posts", async ({
  page,
}, info) => {
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await expect(
    page.getByRole("heading", { name: "Japan 2027", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Date and place" }).locator("time"),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Your RSVP" })).toHaveCount(
    0,
  );
  const rsvp = page.getByRole("group", { name: "Your RSVP" });
  await rsvp.getByRole("button", { name: "Maybe", exact: true }).click();
  await expect(
    rsvp.getByRole("button", { name: "Maybe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await rsvp.getByRole("button", { name: "Clear response" }).click();
  await expect(rsvp.getByRole("button", { pressed: true })).toHaveCount(0);
  const going = rsvp.getByRole("button", { name: "Going", exact: true });
  await going.focus();
  await going.press("Space");
  await expect(going).toHaveAttribute("aria-pressed", "true");
  await checkComposerPlacement(page);
  const composer = page.locator(".margin-space-composer");
  await composer.getByRole("button", { name: "Share a thought…" }).click();
  await page
    .getByLabel("Your post", { exact: true })
    .fill("A plan to finish later.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await composer.getByRole("button", { name: "Share a thought…" }).click();
  await expect(page.getByLabel("Your post", { exact: true })).toHaveValue(
    "A plan to finish later.",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("gathering-interior.png"),
    fullPage: true,
  });
  await page.getByText("Space options", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archive Space", exact: true }),
  ).toBeVisible();
});

test("keeps the Private Space composer above its feed with matching member and option cards", async ({
  page,
}, info) => {
  await page.getByRole("link", { name: /The Reading Room/ }).click();
  await expect(
    page.getByRole("heading", { name: "The Reading Room", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Your RSVP" })).toHaveCount(0);
  await checkComposerPlacement(page);
  await page.screenshot({
    path: info.outputPath("private-interior.png"),
    fullPage: true,
  });
});

test("keeps the Event Space composer above empty and populated feeds", async ({
  page,
}, info) => {
  await page
    .getByRole("textbox", { name: "Search Event Spaces" })
    .fill("Calvin Harris");
  await page.getByRole("button", { name: "Search events" }).click();
  await page
    .getByRole("button", {
      name: "Join Calvin Harris (21 and Over)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: event.name }),
  ).toBeVisible();
  const composer = page.locator(".margin-space-composer");
  const invitation = page.getByRole("button", { name: "Write the first post" });
  const composerBox = await composer.boundingBox();
  const invitationBox = await invitation.boundingBox();
  expect(composerBox!.y + composerBox!.height).toBeLessThan(invitationBox!.y);
  await page
    .getByRole("group", { name: "Your RSVP" })
    .getByRole("button", { name: "Going", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Going", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath("empty-event-interior.png"),
    fullPage: true,
  });
  await invitation.click();
  await expect(page.getByLabel("Your post", { exact: true })).toBeFocused();
  await page
    .getByLabel("Your post", { exact: true })
    .fill("Anyone meeting up before the show?");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("article")).toContainText(
    "Anyone meeting up before the show?",
  );
  await expect(invitation).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share a thought…" }),
  ).toBeVisible();
  await checkComposerPlacement(page);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const buttons = await page
    .getByRole("group", { name: "Your RSVP" })
    .getByRole("button")
    .all();
  for (const button of buttons) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
