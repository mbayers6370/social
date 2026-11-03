import { test, expect } from "./fixtures";
import { mockTicketmasterCatalog } from "./helpers/ticketmaster";

test("starts with artist-only search, joins directly with a four-hour end, and lets an admin adjust it", async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Local Ticketmaster review",
  );
  await mockTicketmasterCatalog(page);
  await page.goto("/preview/spaces");
  const search = page.getByRole("region", { name: "Find an Event Space" });
  await expect(search).toHaveCSS("border-top-width", "1px");
  await expect(
    search.getByRole("textbox", { name: "Search Event Spaces" }),
  ).toHaveValue("");
  await expect(search.getByRole("textbox", { name: /City/ })).toHaveCount(0);
  await expect(search.getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Mumford/ })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Your Spaces" })).toContainText(
    "Japan 2027Gathering Space",
  );
  await expect(page.getByRole("list", { name: "Your Spaces" })).toContainText(
    "Saturday DinnerGathering Space",
  );
  await search
    .getByRole("textbox", { name: "Search Event Spaces" })
    .fill("Calvin Harris");
  await search.getByRole("button", { name: "Search events" }).click();
  const event = search
    .getByRole("listitem")
    .filter({ hasText: "Sat, Nov 7, 2026, 10:30 PM PST" });
  await expect(event).toHaveCount(1);
  await expect(event).toContainText(
    "XS Nightclub at Wynn Las Vegas, Las Vegas, NV",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("ticketmaster-search-card.png"),
    fullPage: true,
  });
  await event
    .getByRole("button", {
      name: "Join Calvin Harris (21 and Over)",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/space=ticketmaster-Z7r9jZ1AAv9uI$/);
  await expect(
    page.getByRole("heading", {
      name: "Calvin Harris (21 and Over)",
      exact: true,
    }),
  ).toBeVisible();
  const about = page.locator(".margin-space-overview");
  const options = page.locator(".margin-space-options");
  await options.locator("summary").click();
  await expect(about).toContainText("Nov 10, 2026, 2:30 AM");
  await options.getByRole("button", { name: "Edit end time" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Scheduled end")).toHaveValue(
    "2026-11-08T02:30",
  );
  await dialog.getByLabel("Scheduled end").fill("2026-11-08T04:00");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(about).toContainText("Nov 10, 2026, 4:00 AM");
  await expect(about).toContainText("48 hours after the event ends");
  await expect(page.locator(".margin-space-composer")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("joined-public-event.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "All Spaces" }).click();
  await expect(
    page
      .getByRole("list", { name: "Your Spaces" })
      .getByRole("link", { name: /Calvin Harris/ }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Find an Event Space" })
      .getByRole("listitem"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New Space" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("radio", { name: "Gathering Space", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("radio", { name: "Event Space", exact: true }),
  ).toHaveCount(0);
});

test("plays the header logo only once across navigation and reload in the same login", async ({
  page,
}) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local login preview");
  await page.goto("/preview/spaces");
  const brand = page.locator(".margin-topbar .margin-brand-link");
  await expect(brand).toHaveAttribute("data-entrance", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "New Space" })).toBeVisible();
  await expect(brand).not.toHaveAttribute("data-entrance");
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await expect(
    page.getByRole("heading", { name: "Japan 2027", exact: true }),
  ).toBeVisible();
  await expect(brand).not.toHaveAttribute("data-entrance");
});
