import { afterEach, expect, it, vi } from "vitest";
import { getDevelopmentOrigins } from "@/lib/development-hosts";

afterEach(() => vi.unstubAllEnvs());

it("defaults to no extra hosts and reads private host configuration", () => {
  vi.stubEnv("MARGIN_DEV_ALLOWED_HOSTS", "");
  expect(getDevelopmentOrigins()).toEqual([]);
  vi.stubEnv("MARGIN_DEV_ALLOWED_HOSTS", "device.example.test");
  expect(getDevelopmentOrigins()).toEqual(["device.example.test"]);
});

it("normalizes and deduplicates exact hostnames", () => {
  expect(
    getDevelopmentOrigins(
      " DEVICE.EXAMPLE.TEST, 192.0.2.10, device.example.test, [::1], ",
    ),
  ).toEqual(["device.example.test", "192.0.2.10", "[::1]"]);
});

it.each([
  "*",
  "*.example.test",
  "https://device.example.test",
  "device.example.test:3000",
  "user:password@device.example.test",
  "device.example.test/path",
  "device.example.test?token=private",
  "device.example.test#private",
])("rejects non-host configuration without echoing it: %s", (value) => {
  expect(() => getDevelopmentOrigins(value)).toThrow(
    "MARGIN_DEV_ALLOWED_HOSTS requires exact hostnames.",
  );
});
