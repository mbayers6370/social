import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let detached = false;
beforeEach(() => {
  detached = false;
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  // File-local teardown must see an already-unmounted component. Otherwise
  // restoring APIs can break pending effects and external-store subscribers.
  expect(detached).toBe(true);
  vi.unstubAllGlobals();
});

function BrowserSubscriber() {
  useEffect(
    () => () => {
      window.matchMedia("(prefers-reduced-motion: reduce)");
      detached = true;
    },
    [],
  );
  return <p>Subscribed</p>;
}

it("unmounts browser subscribers before file-local teardown restores their APIs", () => {
  render(<BrowserSubscriber />);
  expect(screen.getByText("Subscribed")).toBeVisible();
});
