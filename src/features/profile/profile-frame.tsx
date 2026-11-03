"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
/** Shared responsive profile geometry. Content and authority belong to callers. */
export function ProfileFrame({
  personId,
  children,
}: {
  personId: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const page = root.current;
    const identity = page?.querySelector<HTMLElement>(
      ".margin-profile-identity",
    );
    if (!page || !identity) return;
    const measure = () =>
      page.style.setProperty(
        "--profile-identity-height",
        `${identity.getBoundingClientRect().height}px`,
      );
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(identity);
    return () => observer.disconnect();
  }, [personId]);
  return (
    <div className="margin-profile" ref={root}>
      {children}
    </div>
  );
}
