import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { WelcomeReveal } from "@/features/public-site/welcome-reveal";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-motion");
});
const example = (
  <WelcomeReveal>
    <p>A moment between friends.</p>
  </WelcomeReveal>
);
it("keeps the example available in server markup and without the visibility API", () => {
  expect(renderToStaticMarkup(example)).toContain("A moment between friends.");
  vi.stubGlobal("IntersectionObserver", undefined);
  render(example);
  expect(screen.getByText("A moment between friends.")).toBeVisible();
  expect(screen.getByRole("figure")).not.toHaveAttribute("data-reveal");
});
it.each(["system", "setting"])(
  "shows everything immediately for the %s reduced-motion preference",
  (preference) => {
    const observer = vi.fn();
    vi.stubGlobal("IntersectionObserver", observer);
    vi.stubGlobal("matchMedia", () => ({ matches: preference === "system" }));
    if (preference === "setting")
      document.documentElement.dataset.motion = "reduced";
    render(example);
    expect(observer).not.toHaveBeenCalled();
    expect(screen.getByText("A moment between friends.")).toBeVisible();
    expect(screen.getByRole("figure")).not.toHaveAttribute("data-reveal");
  },
);
it("waits until the example enters view, then disconnects the observer and cleans up safely", () => {
  let notify: IntersectionObserverCallback = () => {};
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const { unmount } = render(example);
  const figure = screen.getByRole("figure");
  expect(observe).toHaveBeenCalledWith(figure);
  const event = (isIntersecting: boolean) =>
    notify(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  act(() => event(false));
  expect(figure).not.toHaveAttribute("data-reveal");
  act(() => event(true));
  expect(figure).toHaveAttribute("data-reveal", "active");
  expect(disconnect).toHaveBeenCalledOnce();
  expect(screen.getByText("A moment between friends.")).toBeVisible();
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
  act(() => event(true));
});
