import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const database = ["tests/*-db.integration.test.ts"];
const live = [
  "tests/auth-redis-live.integration.test.ts",
  "tests/music-db.integration.test.ts",
];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    restoreMocks: true,
    clearMocks: true,
    // Hook sequencing is a root-only Vitest option. Unmount components before
    // test files restore their browser stubs.
    sequence: { hooks: "list" },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/*.test.ts"],
          exclude: [...database, ...live],
          setupFiles: ["./tests/setup-node.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/*.test.tsx"],
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          environment: "node",
          include: database,
          exclude: live,
          setupFiles: ["./tests/setup-node.ts"],
          // Suites share one disposable database; races stay inside each test.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "live",
          environment: "node",
          include: live,
        },
      },
    ],
  },
});
