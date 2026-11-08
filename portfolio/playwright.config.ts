import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "../tests/demo",
  fullyParallel: true,
  retries: 0,
  workers: 2,
  outputDir: "../test-results/demo",
  reporter: [["list"], ["json", { outputFile: "../test-reports/demo.json" }]],
  use: {
    baseURL: process.env.DEMO_TEST_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
