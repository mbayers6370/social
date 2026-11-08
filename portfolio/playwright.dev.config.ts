import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("An unprivileged local test port is required.");
const external = process.env.DEMO_DEV_TEST_URL;
if (external) {
  const url = new URL(external);
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Demo development tests may target only a local server.");
}
const url = external ?? `http://127.0.0.1:${port}`;
export default defineConfig({
  ...base,
  // Cold development routes compile on the first navigation.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  testDir: "../tests/demo-dev",
  outputDir: "../test-results/demo-development",
  reporter: [
    ["list"],
    ["json", { outputFile: "../test-reports/demo-development.json" }],
  ],
  use: { ...base.use, baseURL: url },
  webServer: external
    ? undefined
    : {
        command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
        url,
        reuseExistingServer: false,
        timeout: 90_000,
        gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
      },
});
