import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const production = process.env.PLAYWRIGHT_PRODUCTION === "1";
const runningLocalUrl = process.env.PLAYWRIGHT_BASE_URL || undefined;
if (runningLocalUrl) {
  const target = new URL(runningLocalUrl);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    throw new Error("Playwright may target only a local development server");
  }
}
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Caret hiding mutates inline styles and can race React hydration.
  expect: { toHaveScreenshot: { caret: "initial" } },
  use: {
    baseURL: runningLocalUrl ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "chromium-scrollbars",
      testMatch: /feed\.spec\.ts/,
      grep: /opens the correct conversation, keeps Like|keeps the active experience usable/,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
      },
    },
  ],
  webServer: runningLocalUrl
    ? undefined
    : {
        command: production
          ? "npm run start -- --hostname 127.0.0.1 --port 3100"
          : "npm run dev -- --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100/api/health",
        reuseExistingServer: false,
        env: {
          ...(!production
            ? {
                NODE_OPTIONS:
                  `${process.env.NODE_OPTIONS ?? ""} --import ${JSON.stringify(resolve("tests/e2e/server-clock.mjs"))}`.trim(),
              }
            : {}),
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
          CLERK_SECRET_KEY: "",
          NEXT_PUBLIC_SENTRY_DSN: "",
        },
      },
});
