"use client";

import { useEffect, useRef, type RefObject } from "react";

/** A progressive enhancement: posts remain readable before JS or without observers. */
export function useFeedReveal(
  root: RefObject<HTMLElement | null>,
  posts: readonly { id: string }[],
  enabled: boolean,
) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    if (
      !enabled ||
      !root.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reduced = () =>
      preference.matches ||
      document.documentElement.dataset.motion === "reduced";
    const animations = new Set<Animation>();
    let active = true;
    const cancelReduced = () => {
      if (reduced()) for (const animation of animations) animation.cancel();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!active) return;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const post = entry.target as HTMLElement;
          observer.unobserve(post);
          if (seen.current.has(post.id)) continue;
          seen.current.add(post.id);
          if (
            reduced() ||
            post.contains(document.activeElement) ||
            typeof post.animate !== "function"
          )
            continue;
          const animation = post.animate([{ opacity: 0.35 }, { opacity: 1 }], {
            duration: 800,
            easing: "ease-out",
          });
          animations.add(animation);
          animation.onfinish = animation.oncancel = () =>
            animations.delete(animation);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -64px 0px" },
    );
    const ids = new Set(posts.map((post) => post.id));
    for (const post of root.current.querySelectorAll<HTMLElement>(
      ".margin-feed-post",
    )) {
      if (!ids.has(post.id) || seen.current.has(post.id)) continue;
      if (reduced()) seen.current.add(post.id);
      else observer.observe(post);
    }
    preference.addEventListener?.("change", cancelReduced);
    const motion = new MutationObserver(cancelReduced);
    motion.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    return () => {
      active = false;
      observer.disconnect();
      motion.disconnect();
      preference.removeEventListener?.("change", cancelReduced);
      for (const animation of animations) animation.cancel();
    };
  }, [root, posts, enabled]);
}
