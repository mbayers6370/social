"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Only the visibility trigger is client-side; the example content stays server-rendered. */
export function WelcomeReveal({
  children,
  label = "Feed and conversation",
  className = "",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const figure = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = figure.current;
    if (
      !element ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.motion === "reduced"
    )
      return;

    let mounted = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (mounted && entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(element);
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, []);

  return (
    <figure
      ref={figure}
      className={`margin-welcome-preview ${className}`.trim()}
      aria-label={label}
      data-reveal={active ? "active" : undefined}
    >
      {children}
    </figure>
  );
}
