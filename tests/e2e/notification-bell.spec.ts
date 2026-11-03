import { test, expect } from "./fixtures";
import { recordNotificationAnimations } from "./helpers/notification-motion";
test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Local notification data",
  );
  await recordNotificationAnimations(page);
});

test("rings briefly for unread activity and stays still when notifications are read", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
  const bell = page.getByRole("button", {
    name: /^Notifications, [1-9]\d* unread$/,
  });
  await expect(bell).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__notificationRings.length))
    .toBe(1);
  const ring = await page.evaluate(() => {
    const animation = window.__notificationRings[0];
    animation.pause();
    animation.currentTime = 200;
    return {
      id: animation.id,
      duration: animation.effect!.getTiming().duration,
      iterations: animation.effect!.getTiming().iterations,
    };
  });
  expect(ring).toEqual({
    id: "margin-notification-arrival",
    duration: 900,
    iterations: 1,
  });
  await expect(bell.locator("svg")).not.toHaveCSS("transform", "none");
  await page.evaluate(() => window.__notificationRings[0].finish());
  await expect(bell.locator("svg")).toHaveCSS("transform", "none");
  await bell.click();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.locator(".margin-notification-bell")).toHaveAttribute(
    "aria-label",
    "Notifications, 0 unread",
  );
  expect(await page.evaluate(() => window.__notificationRings.length)).toBe(1);
});

test("does not ring when system reduced motion is enabled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
  const bell = page.getByRole("button", {
    name: /^Notifications, [1-9]\d* unread$/,
  });
  await expect(bell).toBeVisible();
  expect(await page.evaluate(() => window.__notificationRings.length)).toBe(0);
  await expect(bell.locator("svg")).toHaveCSS("transform", "none");
});
