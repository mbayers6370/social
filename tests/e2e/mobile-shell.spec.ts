import { expect, test } from "@playwright/test";

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
  await page.screenshot({ path: testInfo.outputPath("compact-bars.png") });
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
  await page.screenshot({
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
  await copyright.scrollIntoViewIfNeeded();
  expect((await copyright.boundingBox())!.y).toBeGreaterThan(
    (await utilities.boundingBox())!.y +
      (await utilities.boundingBox())!.height,
  );
  await page.screenshot({
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
