import { captureScreenshot, expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(
    !isMobile || process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development mobile app shell",
  );
  await page.goto("/");
});

test("keeps the mobile bars compact, preserves tap targets, and accounts for safe areas", async ({
  page,
}, testInfo) => {
  const header = page.locator(".margin-header");
  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });
  await expect(navigation).toHaveCSS("border-top-width", "0px");
  expect(
    await navigation.evaluate(
      (node) => getComputedStyle(node, "::before").content,
    ),
  ).toBe("none");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect((await header.boundingBox())!.height).toBe(48);
    expect((await navigation.boundingBox())!.height).toBe(56);
    for (const control of await navigation.locator("a,button").all()) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await captureScreenshot(page, {
    caret: "initial",
    path: testInfo.outputPath("compact-bars.png"),
  });
  await page.addStyleTag({
    content:
      ":root { --margin-safe-area-top: 47px; --margin-safe-area-bottom: 34px; --margin-safe-area-left: 20px; --margin-safe-area-right: 20px; }",
  });
  expect((await header.boundingBox())!.height).toBe(95);
  expect((await navigation.boundingBox())!.height).toBe(90);
  await expect(page.locator(".margin-app")).toHaveCSS("padding-bottom", "90px");
  expect(
    (await header
      .getByRole("button", { name: "Search profiles" })
      .boundingBox())!.y,
  ).toBeGreaterThanOrEqual(47);
  for (const control of await navigation.locator("a,button").all()) {
    const bounds = (await control.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844 - 34);
  }
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await captureScreenshot(page, {
    caret: "initial",
    path: testInfo.outputPath("simulated-safe-areas.png"),
  });
});

test("keeps enlarged navigation readable and puts utility links under Settings", async ({
  page,
}, testInfo) => {
  await expect(page.locator(".margin-app-footer-desktop")).not.toBeVisible();
  const navigation = page.getByRole("navigation", {
    name: "Mobile navigation",
  });
  await navigation.getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page.locator(".margin-app-footer-desktop")).not.toBeVisible();
  await page
    .locator(".margin-profile-identity")
    .getByRole("button", { name: /^More options for/ })
    .click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const utilities = page.getByRole("navigation", { name: "Help and legal" });
  await expect(
    utilities.getByRole("link", { name: "Privacy", exact: true }),
  ).toHaveAttribute("href", "/privacy");
  await expect(
    utilities.getByRole("link", { name: "Terms", exact: true }),
  ).toHaveAttribute("href", "/terms");
  await expect(
    utilities.getByRole("link", { name: "Help & safety" }),
  ).toHaveAttribute("href", "/help");
  const copyright = page
    .locator(".margin-settings-page .margin-app-footer")
    .getByText("© 2026 margin", { exact: true });
  await expect(copyright).toHaveCount(0);
  for (const [name, href] of [
    ["Copyright", "/copyright"],
    ["Cookies", "/cookies"],
    ["Accessibility", "/accessibility"],
  ])
    await expect(
      utilities.getByRole("link", { name, exact: true }),
    ).toHaveAttribute("href", href);
  const lastLink = utilities.getByRole("link", {
    name: "Cookies",
    exact: true,
  });
  await lastLink.scrollIntoViewIfNeeded();
  await expect(lastLink).toBeInViewport({ ratio: 1 });
  const linkBox = (await lastLink.boundingBox())!;
  expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(
    (await navigation.boundingBox())!.y + 1,
  );
  await captureScreenshot(page, {
    caret: "initial",
    path: testInfo.outputPath("settings-utilities.png"),
  });
  await page.getByRole("radio", { name: "Extra large", exact: true }).check();
  await page.setViewportSize({ width: 320, height: 844 });
  const labels = await navigation
    .locator("a > span:last-child, button > span:not([aria-hidden])")
    .all();
  for (const label of labels) {
    const bounds = (await label.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("uses light olive for the active mobile label and icon across member destinations", async ({
  page,
}) => {
  await memberFixture(page);
  for (const [area, label] of [
    ["feed", "Feed"],
    ["spaces", "Spaces"],
    ["messages", "Messages"],
    ["profile", "Profile"],
  ]) {
    await page.goto(`/preview/auth?view=member&area=${area}`);
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    const current = nav.getByRole("link", { name: label, exact: true });
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toHaveCSS("color", "rgb(153, 150, 78)");
    await expect(
      current.locator(".margin-bottom-icon > :first-child"),
    ).toHaveCSS("color", "rgb(153, 150, 78)");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  }
});
