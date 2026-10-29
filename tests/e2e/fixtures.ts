import { test as base, expect } from "@playwright/test";
import fixtureTime from "./fixture-time.json" with { type: "json" };

export const test = base.extend({
  page: async ({ page }, runTest) => {
    // Only our managed development server loads server-clock.mjs. An attached
    // local server keeps its own clock; don't change its browser's date.
    if (
      process.env.PLAYWRIGHT_PRODUCTION !== "1" &&
      !process.env.PLAYWRIGHT_BASE_URL
    )
      await page.clock.setFixedTime(new Date(fixtureTime));
    await runTest(page);
  },
});

export { expect };
export type { Page } from "@playwright/test";
