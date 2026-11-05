import { captureScreenshot, expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test("main feed joins its composer and posts in one white surface with full-width rules", async ({
  page,
}, info) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixtures");
  await memberFixture(page);
  for (const [name, route] of [
    ["preview", "/"],
    ["member", "/preview/auth?view=member&area=feed-posts"],
  ]) {
    await page.goto(route);
    const surface = page.locator(".margin-feed-surface");
    await expect(surface).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(surface).toHaveCSS("border-top-left-radius", "14px");
    await expect(surface.locator(".margin-feed-composer")).toBeVisible();
    const stream = surface.locator('[data-main-feed="true"]');
    await expect(stream).toBeVisible();
    const posts = stream.locator(".margin-post-card");
    await expect(posts.first()).toBeVisible();
    const geometry = await posts.evaluateAll((cards) =>
      cards.map((card, index) => {
        const style = getComputedStyle(card);
        const stream = card.closest('[data-main-feed="true"]')!;
        const item = Array.from(stream.children).find((child) =>
          child.contains(card),
        )!;
        const rule = getComputedStyle(item, "::before");
        const box = item.getBoundingClientRect();
        const precedingIcon = cards[index - 1]?.querySelector(
          "[data-conversation-trigger] svg",
        );
        const avatar = card.querySelector(".margin-post-author .margin-avatar");
        const lineCenter =
          box.top + parseFloat(rule.top) + parseFloat(rule.height) / 2;
        const compareSpacing =
          precedingIcon && avatar && !item.querySelector(".margin-day-heading");
        return {
          background: style.backgroundColor,
          side: style.borderLeftWidth,
          radius: style.borderRadius,
          divider: rule.content !== "none",
          dividerWidth: parseFloat(rule.width),
          dividerLeft: box.left + parseFloat(rule.left),
          itemWidth: box.width,
          itemLeft: box.left,
          above: compareSpacing
            ? lineCenter - precedingIcon.getBoundingClientRect().bottom
            : undefined,
          below: compareSpacing
            ? avatar.getBoundingClientRect().top - lineCenter
            : undefined,
        };
      }),
    );
    for (const [index, post] of geometry.entries()) {
      expect(post.background).toBe("rgba(0, 0, 0, 0)");
      expect(post.side).toBe("0px");
      expect(post.radius).toBe("0px");
      expect(post.divider).toBe(index !== 0);
      if (post.divider) {
        expect(post.dividerWidth).toBeCloseTo(post.itemWidth, 1);
        expect(post.dividerLeft).toBeCloseTo(post.itemLeft, 1);
      }
      if (post.divider && post.above !== undefined && post.below !== undefined)
        expect(Math.abs(post.above - post.below)).toBeLessThanOrEqual(1);
    }
    expect(await stream.evaluate((node) => getComputedStyle(node).rowGap)).toBe(
      "0px",
    );
    await captureScreenshot(page, {
      path: info.outputPath(`${name}-feed-dividers.png`),
      fullPage: false,
    });
    if (name === "preview" && info.project.name === "chromium") {
      const post = posts.nth(1);
      const item = stream.locator(":scope > [data-day-start]").nth(1);
      const next = stream.locator(":scope > [data-day-start]").nth(2);
      const before = (await item.boundingBox())!;
      const colors = await post.evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, color: style.color };
      });
      await post.locator("[data-conversation-trigger]").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(post).toHaveAttribute("data-phase", "open");
      const after = (await post.boundingBox())!;
      expect(after.x).toBeCloseTo(before.x, 1);
      expect(after.width).toBeCloseTo(before.width, 1);
      const fixedLine = (await item.boundingBox())!;
      expect(fixedLine.x).toBeCloseTo(before.x, 1);
      expect(fixedLine.width).toBeCloseTo(before.width, 1);
      const panel = (await page.getByRole("dialog").boundingBox())!;
      const nextLine = (await next.boundingBox())!;
      await expect(page.getByRole("dialog")).toHaveAttribute(
        "data-layout",
        "inline-flip",
      );
      expect(panel.x).toBeCloseTo(fixedLine.x, 1);
      expect(panel.width).toBeCloseTo(fixedLine.width, 1);
      expect(nextLine.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
      expect(
        await post.evaluate((node) => {
          const style = getComputedStyle(node);
          return {
            background: style.backgroundColor,
            color: style.color,
          };
        }),
      ).toEqual(colors);
      await expect(post).toHaveCSS("border-top-width", "0px");
      await captureScreenshot(page, {
        path: info.outputPath("conversation-inset-from-dividers.png"),
        fullPage: false,
      });
    }
  }
});
