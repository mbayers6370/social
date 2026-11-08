import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { availableParallelism } from "node:os";
import {
  mobileOnlyFiles,
  presentationFiles,
  productionFiles,
} from "./tests/e2e/suites";

const production = process.env.PLAYWRIGHT_PRODUCTION === "1";
const extended = process.env.PLAYWRIGHT_EXTENDED === "1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PLAYWRIGHT_PORT must be an unprivileged local TCP port");
const mode = production ? "production" : "development";
const fileGlobs = (names: string[]) => names.map((name) => `**/${name}`);
const crossBrowserFiles = [
  "authentication.spec.ts",
  "foundation.spec.ts",
  "ink-rules.spec.ts",
  "profile-compose.spec.ts",
  "gallery-delete.spec.ts",
  "post-recovery.spec.ts",
].filter((name) => !production || productionFiles.includes(name));
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
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 2 : Math.min(4, availableParallelism()),
  outputDir: `test-results/${mode}`,
  reporter: [
    ["list"],
    ["json", { outputFile: `test-reports/playwright-${mode}.json` }],
    ["html", { open: "never", outputFolder: `playwright-report/${mode}` }],
  ],
  ...(production ? { testMatch: fileGlobs(productionFiles) } : {}),
  ...(!extended ? { grepInvert: /@extended/ } : {}),
  // Caret hiding mutates inline styles and can race React hydration.
  expect: { toHaveScreenshot: { caret: "initial" } },
  use: {
    baseURL:
      runningLocalUrl ?? `${production ? "https" : "http"}://127.0.0.1:${port}`,
    ignoreHTTPSErrors: production && !runningLocalUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: fileGlobs([
        ...mobileOnlyFiles,
        ...(!extended ? presentationFiles : []),
      ]),
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      ...(!extended ? { testIgnore: fileGlobs(presentationFiles) } : {}),
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    ...(extended
      ? [
          {
            name: "firefox",
            testMatch: fileGlobs(crossBrowserFiles),
            use: { ...devices["Desktop Firefox"] },
          },
          {
            name: "webkit",
            testMatch: fileGlobs(crossBrowserFiles),
            use: { ...devices["Desktop Safari"] },
          },
        ]
      : []),
    ...(!production
      ? [
          {
            name: "chromium-scrollbars",
            testMatch:
              /(?:feed|profile-compose|profile-presentation)\.spec\.ts/,
            grep: /opens the correct conversation, keeps Like|keeps the active experience usable|profile opens New Post|keeps the named friendship status/,
            use: {
              ...devices["Desktop Chrome"],
              launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] },
            },
          },
        ]
      : []),
  ],
  webServer: runningLocalUrl
    ? undefined
    : {
        command: production
          ? "node scripts/testing/production-server.mjs"
          : `npm run app:dev -- --hostname 127.0.0.1 --port ${port}`,
        url: `${production ? "https" : "http"}://127.0.0.1:${port}/api/health`,
        ignoreHTTPSErrors: production,
        reuseExistingServer: false,
        ...(production
          ? { gracefulShutdown: { signal: "SIGTERM" as const, timeout: 5_000 } }
          : {}),
        env: {
          MARGIN_BROWSER_TEST: "1",
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
