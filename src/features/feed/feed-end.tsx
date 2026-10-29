"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
      { threshold: 0.5 },
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
        <span className="sr-only">That’s everything for now.</span>
        <span aria-hidden="true">
          <BrandBrackets>
            {["That’s", "everything", "for", "now."].map((word, index) => (
              <span
                key={word}
                className="margin-feed-end-word"
                style={{ "--word-order": index } as CSSProperties}
              >
                {word}
                {index < 3 ? "\u00a0" : ""}
              </span>
            ))}
          </BrandBrackets>
        </span>
      </p>
    </footer>
  );
}
