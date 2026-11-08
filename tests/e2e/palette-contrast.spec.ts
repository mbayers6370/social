import { test, expect, type Page } from "./fixtures";
import type { Locator } from "@playwright/test";
import { memberFixture } from "./helpers/member-fixture";

/** Measure the real CSS pair, including the profile action's painted surface. */
async function textContrast(target: Locator, paintedSurface = false) {
  await expect(target).toBeVisible();
  const pair = await target.evaluate((element, painted) => {
    const style = getComputedStyle(element);
    const backgrounds: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement)
      backgrounds.unshift(getComputedStyle(node).backgroundColor);
    if (painted)
      backgrounds.push(getComputedStyle(element, "::before").backgroundColor);
    return { foreground: style.color, backgrounds };
  }, paintedSurface);
  const parse = (value: string) => {
    if (!value.startsWith("rgb"))
      throw Error(`Unsupported CSS color: ${value}`);
    return value.match(/[\d.]+/g)!.map(Number);
  };
  const blend = (front: number[], back: number[]) => {
    const alpha = front[3] ?? 1;
    return front
      .slice(0, 3)
      .map((value, i) => value * alpha + back[i] * (1 - alpha));
  };
  const luminance = (color: number[]) =>
    color.reduce((sum, value, i) => {
      const channel = value / 255;
      return (
        sum +
        (channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][i]
      );
    }, 0);
  const background = pair.backgrounds.reduce(
    (back, value) => blend(parse(value), back),
    [255, 255, 255],
  );
  const foreground = blend(parse(pair.foreground), background);
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => a - b,
  );
  expect(
    (values[1] + 0.05) / (values[0] + 0.05),
    JSON.stringify(pair),
  ).toBeGreaterThanOrEqual(4.5);
}

async function checkStates(page: Page, target: Locator, painted = false) {
  await textContrast(target, painted);
  await target.hover();
  await textContrast(target, painted);
  await target.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(target).toBeFocused();
  await textContrast(target, painted);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("welcome primary labels retain AA contrast in default, hover and keyboard focus", async ({
  page,
}) => {
  await page.goto("/welcome");
  for (const target of [
    page.locator(".margin-welcome-cta"),
    page.locator(".margin-public-join"),
  ]) {
    await expect(target).toHaveCSS("background-color", "rgb(153, 150, 78)");
    await expect(target).toHaveCSS("color", "rgb(40, 40, 32)");
  }
  await checkStates(page, page.locator(".margin-welcome-cta"));
  await checkStates(page, page.locator(".margin-public-join"));
  await checkStates(
    page,
    page.getByRole("button", { name: "Join the waitlist", exact: true }),
  );
});

test("Gallery Add photo retains AA contrast in every interactive state", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Member rendering fixture",
  );
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=gallery");
  await checkStates(
    page,
    page.getByRole("button", { name: "Add photo", exact: true }),
  );
});

test("profile primary labels contrast with the inset button surface", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Member rendering fixture",
  );
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=profile");
  await checkStates(
    page,
    page.getByRole("button", { name: "New Post", exact: true }),
    true,
  );
});
