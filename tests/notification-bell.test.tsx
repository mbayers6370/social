import { render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationBellIcon } from "@/features/notifications/notification-bell-icon";

afterEach(() => vi.unstubAllGlobals());
function setup(systemReduced = false) {
  const listeners = new Set<() => void>();
  let reduced = systemReduced;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_event: string, callback: () => void) =>
      listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) =>
      listeners.delete(callback),
  }));
  const animations: { id: string; cancel: ReturnType<typeof vi.fn> }[] = [];
  const animate = vi.fn(() => {
    const animation = { id: "", cancel: vi.fn() };
    animations.push(animation);
    return animation;
  });
  vi.stubGlobal("Animation", class {});
  const original = SVGElement.prototype.animate;
  SVGElement.prototype.animate = animate as unknown as typeof original;
  return {
    animate,
    animations,
    restore: () => {
      SVGElement.prototype.animate = original;
    },
    setReduced: (value: boolean) => {
      reduced = value;
      listeners.forEach((listener) => listener());
    },
  };
}
it("rings once for unread arrivals, including a new item when the unread count is unchanged", () => {
  const mock = setup();
  try {
    const view = render(<NotificationBellIcon unreadIds={["one", "two"]} />);
    expect(mock.animate).toHaveBeenCalledTimes(1);
    expect(mock.animate).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({ duration: 900, iterations: 1 }),
    );
    expect(mock.animations[0].id).toBe("margin-notification-arrival");
    view.rerender(<NotificationBellIcon unreadIds={["one", "two"]} />);
    view.rerender(<NotificationBellIcon unreadIds={["two"]} />);
    expect(mock.animate).toHaveBeenCalledTimes(1);
    view.rerender(<NotificationBellIcon unreadIds={["three"]} />);
    expect(mock.animate).toHaveBeenCalledTimes(2);
    expect(mock.animations[0].cancel).toHaveBeenCalled();
    view.unmount();
    expect(mock.animations[1].cancel).toHaveBeenCalled();
  } finally {
    mock.restore();
  }
});
it("stays still with no unread items and cancels when the last item is read", () => {
  const mock = setup();
  try {
    const view = render(<NotificationBellIcon unreadIds={[]} />);
    expect(mock.animate).not.toHaveBeenCalled();
    view.rerender(<NotificationBellIcon unreadIds={["one"]} />);
    expect(mock.animate).toHaveBeenCalledTimes(1);
    view.rerender(<NotificationBellIcon unreadIds={[]} />);
    expect(mock.animations[0].cancel).toHaveBeenCalled();
  } finally {
    mock.restore();
  }
});
it.each(["system", "app"])(
  "keeps the bell static for %s reduced motion",
  (preference) => {
    const mock = setup(preference === "system");
    try {
      const view = render(
        <NotificationBellIcon
          unreadIds={["one"]}
          paused={preference === "app"}
        />,
      );
      view.rerender(
        <NotificationBellIcon
          unreadIds={["one", "two"]}
          paused={preference === "app"}
        />,
      );
      expect(mock.animate).not.toHaveBeenCalled();
    } finally {
      mock.restore();
    }
  },
);
it("stops an active ring when the app switches to reduced motion", () => {
  const mock = setup();
  try {
    const view = render(<NotificationBellIcon unreadIds={["one"]} />);
    view.rerender(<NotificationBellIcon unreadIds={["one"]} paused />);
    expect(mock.animations[0].cancel).toHaveBeenCalled();
    expect(mock.animate).toHaveBeenCalledTimes(1);
  } finally {
    mock.restore();
  }
});
