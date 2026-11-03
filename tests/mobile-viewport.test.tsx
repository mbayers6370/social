import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileViewport } from "@/components/shared/mobile-viewport";

let viewport: EventTarget & {
  height: number;
  offsetTop: number;
  scale: number;
};
let pending: FrameRequestCallback | undefined;
beforeEach(() => {
  viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("innerWidth", 390);
  vi.stubGlobal("innerHeight", 844);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pending = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  pending = undefined;
  vi.unstubAllGlobals();
});
function flush() {
  const callback = pending;
  pending = undefined;
  act(() => callback?.(0));
}

it("fits the visible keyboard area and releases its values after unmount", () => {
  const app = render(<MobileViewport />);
  Object.assign(viewport, { height: 420, offsetTop: 24 });
  act(() => viewport.dispatchEvent(new Event("resize")));
  flush();
  const style = document.documentElement.style;
  expect(style.getPropertyValue("--margin-viewport-height")).toBe("420px");
  expect(style.getPropertyValue("--margin-viewport-top")).toBe("24px");
  expect(style.getPropertyValue("--margin-viewport-bottom")).toBe("400px");
  app.unmount();
  expect(style.getPropertyValue("--margin-viewport-height")).toBe("");
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(pending).toBeUndefined();
});

it("leaves native pinch zoom and desktop layout in control", () => {
  render(<MobileViewport />);
  viewport.scale = 2;
  act(() => viewport.dispatchEvent(new Event("scroll")));
  flush();
  expect(
    document.documentElement.style.getPropertyValue("--margin-viewport-height"),
  ).toBe("");
  viewport.scale = 1;
  act(() => viewport.dispatchEvent(new Event("resize")));
  flush();
  expect(
    document.documentElement.style.getPropertyValue("--margin-viewport-height"),
  ).toBe("844px");
  vi.stubGlobal("innerWidth", 1280);
  act(() => window.dispatchEvent(new Event("resize")));
  flush();
  expect(
    document.documentElement.style.getPropertyValue("--margin-viewport-height"),
  ).toBe("");
});

it("uses the CSS viewport fallback when VisualViewport is unavailable", () => {
  vi.stubGlobal("visualViewport", undefined);
  render(<MobileViewport />);
  expect(
    document.documentElement.style.getPropertyValue("--margin-viewport-height"),
  ).toBe("");
});
