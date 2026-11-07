"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mobile page scrolling yields space to reading and reveals navigation on return. */
export function ScrollHeader({
  children,
  className,
  resetKey,
}: {
  children: ReactNode;
  className: string;
  resetKey?: string;
}) {
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const mobile = window.matchMedia?.("(max-width: 1023px)");
    if (!mobile) return;
    const position = () =>
      Math.max(
        0,
        Math.min(
          window.scrollY,
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
    let previous = position();
    let downward = 0;
    let frame = 0;
    let height = 0;
    const hide = (hidden: boolean) => {
      const value = String(hidden);
      if (element.dataset.scrollHidden !== value)
        element.dataset.scrollHidden = value;
    };
    const reveal = () => {
      hide(false);
      downward = 0;
    };
    const reset = () => {
      previous = position();
      reveal();
    };
    const measure = () => {
      const measured = element.getBoundingClientRect().height;
      if (height !== measured) {
        height = measured;
        element.style.setProperty("--scroll-header-height", `${height}px`);
      }
    };
    const update = () => {
      frame = 0;
      measure();
      const current = position();
      const delta = current - previous;
      previous = current;
      if (
        !mobile.matches ||
        current <= height ||
        document.body.hasAttribute("data-scroll-locked") ||
        element.querySelector(
          '[aria-expanded="true"], [data-state="open"], :focus-visible',
        )
      ) {
        reveal();
      } else if (delta < 0) {
        reveal();
      } else if (delta > 0) {
        // A little tolerance on descent prevents jitter; ascent has no cooldown.
        downward += delta;
        if (downward >= 8) hide(true);
      }
    };
    const scroll = () => {
      if (mobile.matches && !frame) frame = requestAnimationFrame(update);
    };
    measure();
    reset();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("pageshow", reset);
    mobile.addEventListener("change", reset);
    element.addEventListener("focusin", reveal);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pageshow", reset);
      mobile.removeEventListener("change", reset);
      element.removeEventListener("focusin", reveal);
      element.style.removeProperty("--scroll-header-height");
      delete element.dataset.scrollHidden;
    };
  }, [resetKey]);
  return (
    <header ref={header} className={cn(className, "margin-scroll-header")}>
      {children}
    </header>
  );
}
