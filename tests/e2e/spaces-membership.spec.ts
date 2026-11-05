import { captureScreenshot, test, expect } from "./fixtures";
import { eventFixtures, mockTicketmasterCatalog } from "./helpers/ticketmaster";
import { eventSpacesEnabled } from "../../src/features/spaces/availability";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Local Spaces and music review",
  ),
);
async function ready(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
}

test("caps event results, supports scrolling, and lists joined events with their ticket in Your Spaces", async ({
  page,
}, info) => {
  test.skip(
    !eventSpacesEnabled,
    "Event Spaces are temporarily hidden from the interface",
  );
  await mockTicketmasterCatalog(page, eventFixtures(6));
  await page.goto("/preview/spaces");
  await ready(page);
  const search = page.getByRole("region", { name: "Find an Event Space" });
  await search
    .getByRole("textbox", { name: "Search Event Spaces" })
    .fill("Calvin Harris");
  await search.getByRole("button", { name: "Search events" }).click();
  const results = search.getByRole("list", { name: "Event search results" });
  await expect
    .poll(() => results.getByRole("listitem").count())
    .toBeGreaterThan(4);
  const geometry = await results.evaluate((list) => {
    const fourth = list.children[3].getBoundingClientRect();
    return {
      height: list.clientHeight,
      four: fourth.bottom - list.getBoundingClientRect().top,
      scrollHeight: list.scrollHeight,
    };
  });
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.height);
  if (info.project.name === "mobile")
    expect(geometry.height).toBeLessThanOrEqual(
      page.viewportSize()!.height * 0.65 + 2,
    );
  else expect(Math.abs(geometry.height - geometry.four)).toBeLessThan(3);
  await results.focus();
  await results.press("End");
  await expect
    .poll(() => results.evaluate((n) => n.scrollTop))
    .toBeGreaterThan(0);
  await results.evaluate((n) => {
    n.scrollTop = 0;
  });
  await captureScreenshot(page, {
    path: info.outputPath("capped-event-results.png"),
    fullPage: true,
  });
  await results
    .getByRole("button", { name: /^Join / })
    .first()
    .click();
  await expect(page).toHaveURL(/space=ticketmaster-/);
  const joinedUrl = page.url();
  await page.getByRole("link", { name: "All Spaces" }).click();
  const joined = page
    .getByRole("list", { name: "Your Spaces" })
    .getByRole("link", { name: /Calvin Harris/ });
  await expect(joined).toHaveCount(1);
  await expect(joined.locator(".margin-space-row-icon svg")).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("joined-event-in-your-spaces.png"),
    fullPage: true,
  });
  await joined.click();
  await page.getByText("Members", { exact: true }).click();
  await page.getByRole("button", { name: "Leave Space", exact: true }).click();
  const leave = page.getByRole("alertdialog");
  await expect(leave).toContainText("find and join this Event Space again");
  await leave.getByRole("button", { name: "Leave Space", exact: true }).click();
  await expect(page).toHaveURL(/\/preview\/spaces$/);
  await expect(
    page
      .getByRole("list", { name: "Your Spaces" })
      .getByRole("link", { name: /Calvin Harris/ }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Search Event Spaces" })
    .fill("Calvin Harris");
  await page.getByRole("button", { name: "Search events" }).click();
  await page
    .getByRole("list", { name: "Event search results" })
    .getByRole("button", { name: /^Join / })
    .first()
    .click();
  await expect(page).toHaveURL(joinedUrl);
});

test("lets the creator leave a Gathering Space and close their last-member private Space", async ({
  page,
}) => {
  await page.goto("/preview/spaces");
  await ready(page);
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await page.getByText("Members", { exact: true }).click();
  await page.getByRole("button", { name: "Leave Space", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Another member will take over as administrator",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Leave Space", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Japan 2027/ })).toHaveCount(0);
  await page.getByRole("button", { name: "New Space" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Space name", { exact: true })
    .fill("Temporary private Space");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Temporary private Space", exact: true }),
  ).toBeVisible();
  await page.getByText("Members", { exact: true }).click();
  await page.getByRole("button", { name: "Leave Space", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "content will be deleted",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Leave Space", exact: true })
    .click();
  await expect(page).toHaveURL(/\/preview\/spaces$/);
  await expect(
    page.getByRole("link", { name: /Temporary private Space/ }),
  ).toHaveCount(0);
});

test("searches music from the owner profile using the accepted request marker", async ({
  page,
}) => {
  await page.goto("/?view=profile");
  await ready(page);
  await page.getByRole("button", { name: "Find Music", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Find Music" });
  const response = page.waitForResponse((r) =>
    r.url().includes("/api/development/music?q="),
  );
  await dialog
    .getByRole("searchbox", { name: "Song or artist" })
    .fill("Anchor Novo Amor");
  const result = await response;
  expect(result.request().headers()["x-margin-preview"]).toBe("1");
  expect(result.status()).toBe(200);
  await expect(dialog.getByRole("list", { name: "Songs" })).toContainText(
    "Novo Amor",
  );
  await expect(
    dialog
      .getByRole("button", {
        name: "Add Anchor by Novo Amor",
        exact: true,
      })
      .first(),
  ).toBeVisible();
});
