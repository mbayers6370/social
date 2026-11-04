import { beforeEach, vi } from "vitest";

// A missing provider double must fail immediately, never contact real services.
// PostgreSQL integration uses its real TCP adapter and is unaffected.
beforeEach(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error(
      "Unexpected network request: provide an explicit test transport",
    );
  });
});
