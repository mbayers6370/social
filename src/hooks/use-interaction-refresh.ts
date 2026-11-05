"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Interaction reads only. Duplicate focus/visibility events share a return;
 * a real return during an older read queues one fresh follow-up. No completed
 * response or authorization result is cached, including after failures. */
export function useInteractionRefresh(
  load: (signal: AbortSignal) => Promise<void>,
  {
    enabled = true,
    initial = true,
    scope = "",
  }: { enabled?: boolean; initial?: boolean; scope?: string } = {},
) {
  const loader = useRef(load);
  const pending = useRef<{
    controller: AbortController;
    promise: Promise<void>;
  } | null>(null);
  const followUp = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    loader.current = load;
  }, [load]);
  const refresh = useCallback(
    function run(reason: "manual" | "return" = "manual"): Promise<void> {
      if (!enabled) return Promise.resolve();
      if (pending.current) {
        if (reason === "return") followUp.current = true;
        return pending.current.promise;
      }
      const controller = new AbortController();
      setRefreshing(true);
      const promise = Promise.resolve()
        .then(() => {
          if (!controller.signal.aborted)
            return loader.current(controller.signal);
        })
        .finally(() => {
          if (pending.current?.controller !== controller) return;
          pending.current = null;
          const again = followUp.current && !controller.signal.aborted;
          followUp.current = false;
          if (again) void run().catch(() => undefined);
          else if (!controller.signal.aborted) setRefreshing(false);
        });
      pending.current = { controller, promise };
      return promise;
    },
    [enabled],
  );
  useEffect(
    () => () => {
      pending.current?.controller.abort();
      pending.current = null;
      followUp.current = false;
    },
    [enabled, scope],
  );
  useEffect(() => {
    if (!enabled) return;
    let away = !document.hasFocus();
    if (initial) void refresh().catch(() => undefined);
    const returned = () => {
      if (document.visibilityState === "hidden" || !away) return;
      away = false;
      void refresh("return").catch(() => undefined);
    };
    const blurred = () => {
      away = true;
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") away = true;
      else returned();
    };
    const online = () => {
      if (document.visibilityState !== "hidden")
        void refresh("return").catch(() => undefined);
    };
    window.addEventListener("blur", blurred);
    window.addEventListener("focus", returned);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", blurred);
      window.removeEventListener("focus", returned);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, initial, refresh, scope]);
  return { refresh, refreshing };
}
