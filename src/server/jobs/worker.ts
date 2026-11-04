import { MAINTENANCE_INTERVAL_MS } from "./maintenance";

/** Fixed cadence, including startup. Leases suppress overlap after a slow tick.
 * Shutdown stops new ticks and waits for in-flight erasure before disconnecting. */
export async function maintenanceWorker(
  run: () => Promise<unknown>,
  signal: AbortSignal,
  onFailure: () => void = () =>
    console.error("Maintenance cycle failed; check aggregate job health."),
) {
  if (signal.aborted) return;
  const pending = new Set<Promise<unknown>>();
  const tick = () => {
    const task = run().catch(onFailure);
    pending.add(task);
    void task.finally(() => pending.delete(task));
  };
  tick();
  const timer = setInterval(tick, MAINTENANCE_INTERVAL_MS);
  try {
    await new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
  } finally {
    clearInterval(timer);
    await Promise.allSettled([...pending]);
  }
}
