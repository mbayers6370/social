import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import fixtureTime from "./fixture-time.json" with { type: "json" };
import { readFileSync } from "node:fs";

const providerImage = readFileSync("src/assets/fixtures/coffee-shop.jpg");

export const test = base.extend({
  page: async ({ page, context }, runTest) => {
    const unexpected: string[] = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        return route.continue();
      // Album art and external link destinations are controlled doubles. No
      // real provider receives browsing data or credentials during verification.
      if (request.resourceType() === "image")
        return route.fulfill({
          contentType: "image/jpeg",
          body: providerImage,
        });
      if (request.isNavigationRequest())
        return route.fulfill({
          contentType: "text/html",
          body: "<title>External destination fixture</title>",
        });
      unexpected.push(
        `${request.method()} ${url.hostname} (${request.resourceType()})`,
      );
      return route.abort("blockedbyclient");
    });
    // Only our managed development server loads server-clock.mjs. An attached
    // local server keeps its own clock; don't change its browser's date.
    if (
      process.env.PLAYWRIGHT_PRODUCTION !== "1" &&
      !process.env.PLAYWRIGHT_BASE_URL
    )
      await page.clock.setFixedTime(new Date(fixtureTime));
    await runTest(page);
    expect(
      unexpected,
      "Add an explicit fixture for provider API requests",
    ).toEqual([]);
  },
});

export { expect };
export type { Page } from "@playwright/test";

/** Optional success evidence; failure screenshots are always retained by config. */
export async function captureScreenshot(
  target: Page | Locator,
  options: Parameters<Page["screenshot"]>[0],
) {
  if (process.env.PLAYWRIGHT_CAPTURE === "1") await target.screenshot(options);
}
