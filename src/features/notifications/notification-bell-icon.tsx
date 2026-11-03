"use client";
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { Notification } from "@/components/margin-icons";

const reducedMotion = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(reducedMotion);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const systemReduced = () => window.matchMedia(reducedMotion).matches;

/** A brief arrival cue; reading an item never rings the bell again. */
export function NotificationBellIcon({
  unreadIds,
  paused = false,
  seenIds,
}: {
  unreadIds: readonly string[];
  paused?: boolean;
  seenIds?: RefObject<Set<string>>;
}) {
  const icon = useRef<SVGSVGElement>(null);
  const previous = useRef<ReadonlySet<string>>(new Set());
  const ringing = useRef<Animation | null>(null);
  const reduced = useSyncExternalStore(subscribe, systemReduced, () => false);
  useEffect(() => {
    const next = new Set(unreadIds);
    const arrived = unreadIds.some(
      (id) => !(seenIds?.current ?? previous.current).has(id),
    );
    unreadIds.forEach((id) => seenIds?.current.add(id));
    previous.current = next;
    if (paused || reduced || systemReduced() || !next.size) {
      ringing.current?.cancel();
      ringing.current = null;
      return;
    }
    if (!arrived) return;
    ringing.current?.cancel();
    const animation = icon.current?.animate?.(
      [0, -15, 12, -9, 6, -3, 0].map((angle) => ({
        transform: `rotate(${angle}deg)`,
        transformOrigin: "50% 20%",
      })),
      { duration: 900, iterations: 1, easing: "ease-in-out" },
    );
    if (animation) animation.id = "margin-notification-arrival";
    ringing.current = animation ?? null;
  }, [unreadIds, paused, reduced, seenIds]);
  useEffect(
    () => () => {
      ringing.current?.cancel();
    },
    [],
  );
  return <Notification ref={icon} aria-hidden="true" />;
}
