import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __notificationRings: Animation[];
  }
}

/** Observe real Web Animations even when a short ring finishes before an assertion. */
export async function recordNotificationAnimations(page: Page) {
  await page.addInitScript(() => {
    const rings: Animation[] = [];
    Object.defineProperty(window, "__notificationRings", { value: rings });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      if (this.closest(".margin-notification-bell")) rings.push(animation);
      return animation;
    };
  });
}
