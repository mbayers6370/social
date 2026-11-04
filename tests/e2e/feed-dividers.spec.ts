import { expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test("main feed uses a ruled stream in both preview and member layouts", async ({
  page,
}, info) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixtures");
  await memberFixture(page);
  for (const [name, route] of [
    ["preview", "/"],
    ["member", "/preview/auth?view=member&area=feed-posts"],
  ]) {
    await page.goto(route);
    const stream = page.locator('[data-main-feed="true"]');
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
        const photo = card.querySelector(".margin-post-photos");
        const photoBox = photo?.getBoundingClientRect();
        const precedingIcon = cards[index - 1]?.querySelector(
          "[data-conversation-trigger] svg",
        );
        const avatar = card.querySelector(".margin-post-author .margin-avatar");
        const lineCenter = box.top + parseFloat(rule.height) / 2;
        const compareSpacing =
          precedingIcon && avatar && !item.querySelector(".margin-day-heading");
        return {
          background: style.backgroundColor,
          side: style.borderLeftWidth,
          radius: style.borderRadius,
          divider: rule.content !== "none",
          dividerWidth: parseFloat(rule.width),
          dividerLeft: box.left + parseFloat(rule.left),
          photoWidth: photoBox?.width,
          photoLeft: photoBox?.left,
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
      if (post.divider && post.photoWidth !== undefined) {
        expect(post.dividerWidth).toBeCloseTo(post.photoWidth, 1);
        expect(post.dividerLeft).toBeCloseTo(post.photoLeft!, 1);
      }
      if (post.divider && post.above !== undefined && post.below !== undefined)
        expect(Math.abs(post.above - post.below)).toBeLessThanOrEqual(1);
    }
    expect(await stream.evaluate((node) => getComputedStyle(node).rowGap)).toBe(
      "0px",
    );
    await page.screenshot({
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
      expect(after.x).toBeLessThan(before.x - 100);
      expect(after.width).toBeCloseTo(before.width, 1);
      const fixedLine = (await item.boundingBox())!;
      expect(fixedLine.x).toBeCloseTo(before.x, 1);
      expect(fixedLine.width).toBeCloseTo(before.width, 1);
      const panel = (await page.getByRole("dialog").boundingBox())!;
      const nextLine = (await next.boundingBox())!;
      expect(panel.y - fixedLine.y).toBeGreaterThanOrEqual(16);
      expect(nextLine.y - (panel.y + panel.height)).toBeGreaterThanOrEqual(16);
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
      await page.screenshot({
        path: info.outputPath("conversation-inset-from-dividers.png"),
        fullPage: false,
      });
    }
  }
});
