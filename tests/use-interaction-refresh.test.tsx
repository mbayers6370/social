import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useInteractionRefresh } from "@/hooks/use-interaction-refresh";
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("does not issue requests during ten idle minutes and coalesces repeated return events", async () => {
  vi.useFakeTimers();
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const load = vi.fn(async () => {});
  renderHook(() => useInteractionRefresh(load));
  await act(async () => {});
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600000);
  });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(3);
});
it("shares concurrent manual reads but lets an explicit refresh retry immediately after failure", async () => {
  let finish!: () => void;
  const load = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() =>
    useInteractionRefresh(load, { initial: false }),
  );
  let first!: Promise<void>, second!: Promise<void>;
  await act(async () => {
    first = result.current.refresh();
    second = result.current.refresh();
  });
  expect(first).toBe(second);
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await first;
  });
  load.mockRejectedValueOnce(Error("offline"));
  await act(async () => {
    await expect(result.current.refresh()).rejects.toThrow("offline");
  });
  load.mockResolvedValueOnce();
  await act(async () => {
    await result.current.refresh();
  });
  expect(load).toHaveBeenCalledTimes(3);
});
it("skips hidden-tab returns and aborts the old read when the conversation changes", async () => {
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  const signals: AbortSignal[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        signals.push(signal);
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
  );
  const { rerender, unmount } = renderHook(
    ({ scope }) => useInteractionRefresh(load, { scope, initial: false }),
    { initialProps: { scope: "first" } },
  );
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  rerender({ scope: "second" });
  expect(signals[0].aborted).toBe(true);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(2);
  unmount();
  expect(signals[1].aborted).toBe(true);
});

it("queues one fresh read when returning during an older in-flight request", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  const complete: (() => void)[] = [];
  const load = vi.fn(
    () => new Promise<void>((resolve) => complete.push(resolve)),
  );
  const { result } = renderHook(() => useInteractionRefresh(load));
  await act(async () => {});
  await act(async () => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => {
    complete[0]();
  });
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.refreshing).toBe(true);
  await act(async () => {
    complete[1]();
  });
  expect(result.current.refreshing).toBe(false);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(load).toHaveBeenCalledTimes(2);
});
