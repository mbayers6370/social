"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Enhance the public illustration once; keep its full text and space in server markup. */
export function WelcomeMessageArrival({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reduced = () =>
      motion?.matches || document.documentElement.dataset.motion === "reduced";
    if (!element || typeof IntersectionObserver === "undefined" || reduced())
      return;

    let played = false;
    let disposed = false;
    let timer: number | undefined;
    element.dataset.arrival = "waiting";
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          disposed ||
          played ||
          !entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.25,
          )
        )
          return;
        played = true;
        observer.disconnect();
        element.dataset.arrival = "typing";
        timer = window.setTimeout(() => {
          if (!disposed) element.dataset.arrival = "delivered";
        }, 1200);
      },
      { threshold: 0.25 },
    );
    observer.observe(element.closest("figure") ?? element);
    const respectMotion = () => {
      if (!reduced() || disposed) return;
      played = true;
      window.clearTimeout(timer);
      observer.disconnect();
      delete element.dataset.arrival;
    };
    motion?.addEventListener("change", respectMotion);
    const preferences = new MutationObserver(respectMotion);
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      preferences.disconnect();
      motion?.removeEventListener("change", respectMotion);
      delete element.dataset.arrival;
    };
  }, []);
  return (
    <div ref={root} className="margin-welcome-message-arrival">
      <p
        className="margin-welcome-message-bubble margin-welcome-message-typing"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </p>
      {children}
    </div>
  );
}
