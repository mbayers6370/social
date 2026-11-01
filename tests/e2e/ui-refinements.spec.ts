import { expect, test } from "./fixtures";
test("photographs stay selected until confirmed and retain saved alt text", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Photograph fixtures are development-only",
  );
  await page.goto("/?view=profile");
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page.getByRole("button", { name: "Change profile photograph" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a photograph" });
  const use = picker.getByRole("button", {
    name: "Use Photograph",
    exact: true,
  });
  await expect(use).toBeDisabled();
  const photo = picker.getByRole("button", { name: /^Select / }).first();
  const description = await photo.locator("img").getAttribute("alt");
  await photo.click();
  await expect(photo).toHaveAttribute("aria-pressed", "true");
  await expect(photo.locator(".margin-photo-selected-mark")).toBeVisible();
  await expect(photo).toHaveCSS("border-top-width", "3px");
  await expect(
    picker.getByRole("textbox", { name: "Describe the photograph (alt text)" }),
  ).toHaveValue(description!);
  await expect(use).toBeEnabled();
  await page.screenshot({
    path: `test-results/selected-photo-${testInfo.project.name}.png`,
  });
  await use.click();
  await expect(
    page.getByRole("dialog", { name: "Your Profile Photograph" }),
  ).toBeVisible();
});
test("quiet flags have a dismissible keyboard tooltip and account actions are outlined", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Post and account fixtures are development-only",
  );
  await page.goto("/");
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
  await page.screenshot({
    path: `test-results/outlined-account-${testInfo.project.name}.png`,
  });
});
test("public sign-in stays outlined without overflowing narrow screens", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/welcome");
  await expect(
    page
      .getByRole("navigation", { name: "Public navigation" })
      .getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCSS("border-top-width", "1px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
