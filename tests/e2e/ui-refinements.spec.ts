import { captureScreenshot, expect, test } from "./fixtures";
test("profile flags have a dismissible keyboard tooltip and account actions are outlined", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Post and account fixtures are development-only",
  );
  await page.goto("/?view=profile&person=samuel");
  const flag = page
    .locator(".margin-feed-post")
    .first()
    .getByRole("button", { name: "Report post" });
  await flag.focus();
  await expect(
    page.getByRole("tooltip", { name: "Report post" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(flag).toBeFocused();
  await page.keyboard.press("Enter");
  const report = page.getByRole("dialog", { name: "Report post" });
  await expect(
    report.getByRole("button", { name: "Save report", exact: true }),
  ).toBeVisible();
  await expect(
    report.getByRole("button", { name: "Submit report", exact: true }),
  ).toHaveCount(0);
  await report.getByLabel("Reason").selectOption("spam");
  await report
    .getByRole("button", { name: "Save report", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Report saved" }),
  ).toContainText("Live moderation is not connected");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  const menu = page.getByRole("navigation", {
    name: "Profile menu",
    exact: true,
  });
  for (const action of [
    menu.getByRole("link", { name: "Sign in", exact: true }),
    menu.getByRole("button", { name: "Exit preview", exact: true }),
  ])
    await expect(action).toHaveCSS("border-top-width", "1px");
  await captureScreenshot(page, {
    path: `test-results/outlined-account-${testInfo.project.name}.png`,
  });
});
