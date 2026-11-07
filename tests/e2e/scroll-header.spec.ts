import { expect, test, type Page } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
}

test("public header yields to reading and returns on the first upward movement", async ({
  page,
  isMobile,
}) => {
  await page.goto("/welcome");
  const header = page.locator(".margin-scroll-header");
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  const mainTop = await page.locator("main").evaluate((el) => {
    return el.getBoundingClientRect().top + scrollY;
  });
  await scrollTo(page, 600);
  if (isMobile) {
    await expect(header).toHaveAttribute("data-scroll-hidden", "true");
    await expect
      .poll(async () => {
        const box = (await header.boundingBox())!;
        return box.y + box.height;
      })
      .toBeLessThanOrEqual(1);
  } else {
    await expect(header).toHaveAttribute("data-scroll-hidden", "false");
    await expect(header).toBeInViewport({ ratio: 1 });
  }
  expect(
    await page.locator("main").evaluate((el) => {
      return el.getBoundingClientRect().top + scrollY;
    }),
  ).toBe(mainTop);
  await scrollTo(page, 599);
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  await expect(header).toBeInViewport({ ratio: 1 });
  await scrollTo(page, 0);
  await expect(header).toBeInViewport({ ratio: 1 });
});

test("member header protects menus and keyboard focus, and resets across breakpoints", async ({
  page,
  isMobile,
}) => {
  test.skip(
    !isMobile || process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Mobile member rendering fixture",
  );
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=profile");
  const header = page.locator(".margin-header");
  const bottom = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  // The profile fixture is short; exercise real page scrolling below its content.
  await page.locator("main").evaluate((el) => {
    el.style.minHeight = "2200px";
  });
  await scrollTo(page, 600);
  await expect(header).toHaveAttribute("data-scroll-hidden", "true");
  await expect(bottom).toBeInViewport({ ratio: 1 });
  await scrollTo(page, 599);
  await expect(header).toBeInViewport({ ratio: 1 });
  const menu = header.getByRole("button", {
    name: "Profile menu",
    exact: true,
  });
  await menu.click();
  await scrollTo(page, 900);
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(header).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await scrollTo(page, 1000);
  await expect(header).toBeInViewport({ ratio: 1 });
  await menu.evaluate((el) => el.blur());
  await scrollTo(page, 1100);
  await expect(header).toHaveAttribute("data-scroll-hidden", "true");
  await header.getByRole("button", { name: "Search profiles" }).focus();
  await expect(header).toBeInViewport({ ratio: 1 });
  await page.setViewportSize({ width: 1200, height: 844 });
  await scrollTo(page, 1200);
  await expect(header).toBeInViewport({ ratio: 1 });
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
});

test("reduced motion removes the header transition", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile header motion");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/welcome");
  const header = page.locator(".margin-scroll-header");
  await expect(header).toHaveAttribute("data-scroll-hidden", "false");
  await expect(header).toHaveCSS("transition-property", "none");
  await scrollTo(page, 600);
  await expect(header).toHaveAttribute("data-scroll-hidden", "true");
  await scrollTo(page, 599);
  await expect(header).toBeInViewport({ ratio: 1 });
});
