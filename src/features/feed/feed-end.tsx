"use client";

import { useEffect, useRef, useState } from "react";
import { BrandBrackets } from "@/components/shared/brand-brackets";

export function FeedEnd() {
  const line = useRef<HTMLParagraphElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = line.current;
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
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(element);
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, []);

  return (
    <footer
      className="margin-feed-end"
      data-reveal={revealed ? "active" : undefined}
    >
      <p ref={line}>
        <BrandBrackets>That’s everything for now.</BrandBrackets>
      </p>
    </footer>
  );
}
