"use client";

import { useEffect } from "react";

/** One viewport owner for mobile dialogs, sheets and message composers. */
export function MobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const properties = [
      "--margin-viewport-height",
      "--margin-viewport-top",
      "--margin-viewport-bottom",
    ];
    let frame = 0;
    const clear = () =>
      properties.forEach((property) => root.style.removeProperty(property));
    const update = () => {
      frame = 0;
      // Native pinch zoom must keep its own panning and magnification behavior.
      if (window.innerWidth >= 1024 || viewport.scale !== 1) {
        clear();
        return;
      }
      root.style.setProperty(properties[0], `${viewport.height}px`);
      root.style.setProperty(properties[1], `${viewport.offsetTop}px`);
      root.style.setProperty(
        properties[2],
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      clear();
    };
  }, []);
  return null;
}
