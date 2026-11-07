import { act, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WelcomeMessages } from "@/features/public-site/welcome-preview";

let notify: IntersectionObserverCallback;
let preferenceChanged: () => void;
const observe = vi.fn();
const disconnect = vi.fn();
const motion = {
  matches: false,
  addEventListener: vi.fn((_name: string, listener: () => void) => {
    preferenceChanged = listener;
  }),
  removeEventListener: vi.fn(),
};
const slot = () => screen.getByText("Ten o’clock. I’m buying.").parentElement!;
const enter = (ratio = 1) => {
  act(() => {
    notify(
      [
        {
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  motion.matches = false;
  vi.stubGlobal("matchMedia", () => motion);
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
});
afterEach(() => {
  delete document.documentElement.dataset.motion;
});

it("keeps the complete message in server markup without a typing delay", () => {
  const html = renderToStaticMarkup(<WelcomeMessages />);
  expect(html).toContain("Ten o’clock. I’m buying.");
  expect(html).not.toContain("data-arrival");
});

it("waits for the panel to enter, types briefly, then delivers only once", () => {
  render(<WelcomeMessages />);
  expect(observe).toHaveBeenCalledWith(
    screen.getByRole("figure", { name: "Messages between friends" }),
  );
  expect(slot()).toHaveAttribute("data-arrival", "waiting");
  enter(0.1);
  act(() => vi.advanceTimersByTime(5000));
  expect(slot()).toHaveAttribute("data-arrival", "waiting");
  enter(0.25);
  expect(slot()).toHaveAttribute("data-arrival", "typing");
  expect(
    slot().querySelector(".margin-welcome-message-typing"),
  ).toHaveAttribute("aria-hidden", "true");
  act(() => vi.advanceTimersByTime(1199));
  expect(slot()).toHaveAttribute("data-arrival", "typing");
  act(() => vi.advanceTimersByTime(1));
  expect(slot()).toHaveAttribute("data-arrival", "delivered");
  enter();
  expect(slot()).toHaveAttribute("data-arrival", "delivered");
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["system", "account"])("skips typing for %s reduced motion", (kind) => {
  if (kind === "system") motion.matches = true;
  else document.documentElement.dataset.motion = "reduced";
  render(<WelcomeMessages />);
  expect(slot()).not.toHaveAttribute("data-arrival");
  expect(observe).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["system", "account"])(
  "reveals immediately if %s reduced motion changes during typing",
  async (kind) => {
    render(<WelcomeMessages />);
    enter();
    await act(async () => {
      if (kind === "system") {
        motion.matches = true;
        preferenceChanged();
      } else document.documentElement.dataset.motion = "reduced";
    });
    expect(slot()).not.toHaveAttribute("data-arrival");
    expect(vi.getTimerCount()).toBe(0);
    enter();
    expect(slot()).not.toHaveAttribute("data-arrival");
  },
);

it("shows the complete message when visibility observation is unavailable", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<WelcomeMessages />);
  expect(slot()).not.toHaveAttribute("data-arrival");
});

it("cancels pending delivery and visibility work on unmount", () => {
  const view = render(<WelcomeMessages />);
  enter();
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
  expect(disconnect).toHaveBeenCalled();
  expect(motion.removeEventListener).toHaveBeenCalledWith(
    "change",
    preferenceChanged,
  );
});
