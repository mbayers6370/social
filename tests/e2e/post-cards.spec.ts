import { expect, test } from "./fixtures";

test("post skeleton preview announces loading, respects reduced motion, and restores content", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "The component workbench is development-only",
  );
  await page.goto("/design-system");
  const preview = page.getByRole("region", { name: "Post cards" });
  await expect(preview.getByRole("article")).toContainText(
    "Need a new recommendation for the commute.",
  );
  await expect(preview.getByRole("status")).toHaveCount(0);
  await preview.getByRole("button", { name: "Show loading preview" }).click();
  const status = preview.getByRole("status");
  await expect(status).toBeVisible();
  await expect(status).toContainText("Loading post…");
  await expect(preview.getByRole("article")).toHaveCount(0);
  await expect(status.locator("[aria-hidden=true]")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      status
        .locator(".margin-post-skeleton-content")
        .evaluate((node) => getComputedStyle(node).animationName),
    )
    .toBe("none");
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("post-skeleton.png"),
  });
  const toggle = preview.getByRole("button", { name: "Show loaded post" });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(preview.getByRole("article")).toContainText(
    "Need a new recommendation for the commute.",
  );
  await expect(preview.getByRole("status")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Show loading preview" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
