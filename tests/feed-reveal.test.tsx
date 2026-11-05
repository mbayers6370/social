import { useRef } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useFeedReveal } from "@/features/feed/use-feed-reveal";

let notify: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
const animate = vi.fn();
const cancel = vi.fn();
const originalAnimate = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate",
);
const preference = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
const posts = [{ id: "first" }, { id: "below" }];
function Feed({ enabled = true }: { enabled?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useFeedReveal(root, posts, enabled);
  return (
    <div ref={root}>
      {posts.map((post) => (
        <article id={post.id} className="margin-feed-post" key={post.id}>
          {post.id}
        </article>
      ))}
    </div>
  );
}
function enter(id = "below") {
  notify(
    [
      {
        target:
          document.getElementById(id) ?? document.createElement("article"),
        isIntersecting: true,
        boundingClientRect: new DOMRect(),
        intersectionRect: new DOMRect(),
        rootBounds: null,
        intersectionRatio: 1,
        time: 0,
      },
    ],
    {} as IntersectionObserver,
  );
}
beforeEach(() => {
  preference.matches = false;
  vi.clearAllMocks();
  animate.mockReturnValue({ cancel, onfinish: null, oncancel: null });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  vi.stubGlobal("matchMedia", () => preference);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  if (originalAnimate)
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});
it("reveals every feed post once, including posts visible at first load", () => {
  const view = render(<Feed />);
  expect(observe).toHaveBeenCalledTimes(2);
  expect(observe).toHaveBeenCalledWith(document.getElementById("first"));
  expect(observe).toHaveBeenCalledWith(document.getElementById("below"));
  expect(animate).not.toHaveBeenCalled();
  act(() => enter("first"));
  act(enter);
  expect(animate).toHaveBeenCalledWith([{ opacity: 0.35 }, { opacity: 1 }], {
    duration: 800,
    easing: "ease-out",
  });
  act(enter);
  act(() => enter("first"));
  view.rerender(<Feed />);
  expect(animate).toHaveBeenCalledTimes(2);
  expect(unobserve).toHaveBeenCalledWith(document.getElementById("below"));
});
it.each(["system", "account"])(
  "skips the fade for %s reduced motion",
  (kind) => {
    if (kind === "system") preference.matches = true;
    else document.documentElement.dataset.motion = "reduced";
    render(<Feed />);
    expect(observe).not.toHaveBeenCalled();
    expect(screen.getByText("below")).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
  },
);
it("cancels an active fade when account motion changes to reduced", async () => {
  render(<Feed />);
  act(enter);
  document.documentElement.dataset.motion = "reduced";
  await waitFor(() => expect(cancel).toHaveBeenCalled());
});
it("does not animate profile or Space-only timelines", () => {
  render(<Feed enabled={false} />);
  expect(observe).not.toHaveBeenCalled();
  expect(screen.getByText("below")).toBeVisible();
});
it("leaves posts readable without IntersectionObserver", () => {
  vi.stubGlobal("IntersectionObserver", undefined);
  render(<Feed />);
  expect(screen.getByText("below")).toBeVisible();
  expect(animate).not.toHaveBeenCalled();
});
it("disconnects and cancels on unmount, including queued intersections", () => {
  const view = render(<Feed />);
  act(enter);
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(cancel).toHaveBeenCalled();
  act(enter);
  expect(animate).toHaveBeenCalledTimes(1);
});
