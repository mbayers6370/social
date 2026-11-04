"use client";

import { ChevronLeft, ChevronRight } from "@/components/margin-icons";
import { useWelcomeDemo } from "./welcome-interactive";

export function WelcomePreviewLink() {
  const { stage, setStage } = useWelcomeDemo();
  const open = stage === "back";
  return (
    <a
      href="#welcome-preview"
      className="margin-public-text-link"
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const target = document.getElementById("welcome-preview");
        const card = target?.querySelector(".margin-welcome-preview");
        if (!target || !card) return;
        event.preventDefault();
        if (window.matchMedia("(max-width: 1023px)").matches) {
          target.scrollIntoView({ block: "start", behavior: "instant" });
          target.focus({ preventScroll: true });
        }
        const previous = card
          .getAnimations()
          .find((animation) => animation.id === "welcome-preview-shake");
        previous?.cancel();
        if (stage !== "initial") {
          setStage(open ? "front" : "back");
          return;
        }
        setStage("invited");
        const reducedMotion = () =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          document.documentElement.dataset.motion === "reduced";
        if (reducedMotion()) return;
        card.animate(
          [0, -8, 7, -5, 3, 0].map((x) => ({
            transform: `translateX(${x}px)`,
          })),
          { id: "welcome-preview-shake", duration: 600, easing: "ease-in-out" },
        );
      }}
    >
      {open && <ChevronLeft aria-hidden="true" />}
      {stage === "initial"
        ? "See how it feels"
        : open
          ? "Turn it back"
          : "Flip the card"}
      {!open && <ChevronRight aria-hidden="true" />}
    </a>
  );
}
