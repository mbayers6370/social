// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { maintenanceWorker } from "@/server/jobs/worker";
afterEach(() => vi.useRealTimers());
it("runs at startup and every minute, continues after a failure, and stops cleanly", async () => {
  vi.useFakeTimers();
  const run = vi
    .fn()
    .mockRejectedValueOnce(Error("do not log raw failures"))
    .mockResolvedValue(undefined);
  const failure = vi.fn();
  const controller = new AbortController();
  const worker = maintenanceWorker(run, controller.signal, failure);
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(1);
  expect(failure).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(run).toHaveBeenCalledTimes(3);
  controller.abort();
  await worker;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(3);
});
