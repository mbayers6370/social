"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Confirmations expire; relationship labels and actionable errors stay visible. */
export function useFriendFeedback() {
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(true);
  const showStatus = useCallback((message: string) => {
    if (!active.current) return;
    clearTimeout(timer.current);
    setStatus(message);
    timer.current = message ? setTimeout(() => setStatus(""), 6000) : undefined;
  }, []);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  return [status, showStatus] as const;
}
