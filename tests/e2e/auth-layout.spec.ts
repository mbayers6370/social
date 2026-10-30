import { expect, test } from "./fixtures";
test("centers account cards and offers a single direct preview action", async ({
  page,
}, testInfo) => {
  const production = process.env.PLAYWRIGHT_PRODUCTION === "1";
  const mobile = testInfo.project.name === "mobile";
  const sizes = mobile
    ? [
        { width: 320, height: 568 },
        { width: 375, height: 667 },
        { width: 390, height: 844 },
      ]
    : [{ width: 1280, height: 1000 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const route of ["/sign-in", "/sign-up"]) {
      await page.goto(route);
      const card = page.getByRole("main");
      await expect(card).toBeVisible();
      const geometry = await card.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const shell = node.closest(".margin-auth-page")!;
        const style = getComputedStyle(shell);
        const page = document.body.getBoundingClientRect();
        return {
          x: box.x + box.width / 2,
          pageCenterX: page.x + page.width / 2,
          y: box.y + box.height / 2,
          fits:
            box.height +
              parseFloat(style.paddingTop) +
              parseFloat(style.paddingBottom) <=
            innerHeight,
          cardTop: box.top,
        };
      });
      expect(Math.abs(geometry.x - geometry.pageCenterX)).toBeLessThan(1);
      if (geometry.fits)
        expect(
          Math.abs(geometry.y - page.viewportSize()!.height / 2),
        ).toBeLessThan(1);
      else expect(geometry.cardTop).toBeGreaterThanOrEqual(100);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (mobile) {
        expect(
          await page.evaluate(
            () => document.scrollingElement!.scrollHeight <= innerHeight + 1,
          ),
        ).toBe(true);
        const bounds = (await card.boundingBox())!;
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
        const links = card.locator("footer a");
        for (const link of await links.all())
          expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      if (route === "/sign-in") {
        await expect(
          page.getByRole("link", { name: "Explore the preview", exact: true }),
        ).toHaveCount(production ? 0 : 1);
        await expect(page.locator("details")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Join Margin", exact: true }),
        ).toHaveCount(1);
        await expect(
          page.getByText("Continue to the preview", { exact: true }),
        ).toHaveCount(0);
      } else
        await expect(
          page.getByRole("link", { name: "Sign in", exact: true }),
        ).toHaveCount(1);
      await page.screenshot({
        path: `test-results/auth-${route.slice(1)}-${size.width}x${size.height}.png`,
        fullPage: true,
      });
    }
  }
  await expect(page.locator("details")).toHaveCount(0);
  if (production) {
    await expect(
      page.getByRole("link", { name: "Preview profile setup", exact: true }),
    ).toHaveCount(0);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/sign-in$/);
    return;
  }
  await page
    .getByRole("link", { name: "Preview profile setup", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Make yourself at home.",
  );
  await page.goto("/sign-in");
  await page
    .getByRole("link", { name: "Explore the preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Feed", exact: true }),
  ).toBeVisible();
});
