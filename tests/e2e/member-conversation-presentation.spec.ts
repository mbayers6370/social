import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture, identity, friend } from "./helpers/member-fixture";
import type { Page } from "./fixtures";

async function discussion(page: Page) {
  await memberFixture(page);
  let liked = false;
  const comments = [
    {
      id: "first-comment",
      body: "A thought from a friend.",
      createdAt: "2026-11-02T19:00:00Z",
      author: friend,
    },
  ];
  await page.route(
    "**/__member_fixture/api/posts/*/comments",
    async (route) => {
      if (route.request().method() === "POST") {
        const input = route.request().postDataJSON();
        comments.push({
          id: "saved-comment",
          body: input.body,
          createdAt: "2026-11-02T20:00:00Z",
          author: identity.person,
          ...(input.replyTo ? { replyTo: input.replyTo } : {}),
        });
        return route.fulfill({ status: 201, json: { id: "saved-comment" } });
      }
      return route.fulfill({
        json: {
          comments,
          nextCursor: null,
          readOnly: false,
          viewer: identity.person,
          liked,
          likeCount: liked ? 3 : 2,
        },
      });
    },
  );
  await page.route("**/__member_fixture/api/posts/*/like", (route) => {
    liked = route.request().postDataJSON().liked;
    return route.fulfill({ json: { liked, count: liked ? 3 : 2 } });
  });
}

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Fictional member rendering; real endpoints stay protected",
  ),
);

for (const area of ["feed-posts", "profile"]) {
  test(`restores the approved ${area} conversation appearance, motion, replies and return focus`, async ({
    page,
    isMobile,
  }, info) => {
    await discussion(page);
    await page.goto(`/preview/auth?view=member&area=${area}`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-reading-size",
      "standard",
    );
    const post = page.locator("article").first();
    const trigger = post.getByRole("button", { name: /^Conversation on/ });
    await trigger.evaluate((node) => node.scrollIntoView({ block: "center" }));
    const before = (await post.boundingBox())!;
    const scroll = await page.evaluate(() => scrollY);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: /^Conversation on/ });
    const mode = isMobile ? "flip" : "inline-flip";
    await expect(dialog).toHaveAttribute("data-layout", mode);
    await expect(post).toHaveAttribute("data-phase", "open");
    const motion = await dialog.evaluate((node) =>
      node.getAnimations().map((animation) => ({
        duration: animation.effect!.getTiming().duration,
        transforms: (animation.effect as KeyframeEffect)
          .getKeyframes()
          .map((frame) => frame.transform),
      })),
    );
    expect(motion.some((animation) => animation.duration === 520)).toBe(true);
    expect(
      motion.some((animation) =>
        animation.transforms.some((transform) =>
          String(transform).includes("rotateY"),
        ),
      ),
    ).toBe(true);
    await expect(dialog.locator(".margin-space-conversation")).toHaveCount(0);
    await expect(dialog.locator(".margin-conversation-scroll")).toHaveCSS(
      "overflow-y",
      "auto",
    );
    await expect(dialog.locator(".margin-conversation-composer")).toHaveCSS(
      "flex-shrink",
      "0",
    );
    if (isMobile) {
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeCloseTo(0, 0);
      expect(bounds.y).toBeCloseTo(0, 0);
      expect(bounds.height).toBeCloseTo(page.viewportSize()!.height, 0);
    } else {
      expect((await dialog.boundingBox())!.width).toBeCloseTo(before.width, 0);
      await expect(dialog).toHaveCSS("border-top-left-radius", "0px");
    }
    const snapshot = dialog.locator(".margin-conversation-front img").first();
    await expect
      .poll(() =>
        snapshot.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(snapshot).not.toHaveAttribute("src", /_next\/image/);
    await dialog.getByRole("button", { name: "Like", exact: true }).click();
    await expect(dialog.locator("[data-like-count]")).toHaveText("3 likes");
    await expect(
      dialog.getByRole("button", { name: "Liked", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("button", { name: /^Reply to/ }).click();
    await dialog
      .getByRole("textbox", { name: "Reply to Alex Example" })
      .fill("A reply to keep.");
    await dialog.getByRole("button", { name: "Post", exact: true }).click();
    await expect(
      dialog.getByText("A reply to keep.", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("A reply to keep.", { exact: true }),
    ).toBeInViewport();
    await expect(dialog.locator("[data-like-count]")).toHaveText("3 likes");
    await captureScreenshot(page, {
      path: info.outputPath(`${area}-conversation.png`),
      caret: "initial",
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.pageErrors()).toEqual([]);
  });
}

test("keeps reduced-motion conversation presentation usable without a card turn", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await discussion(page);
  await page.goto("/preview/auth?view=member&area=profile");
  const trigger = page.getByRole("button", { name: /^Conversation on/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /^Conversation on/ });
  await expect(dialog).toHaveClass(/margin-conversation-reduced/);
  await expect(dialog).toHaveCSS("transform", "none");
  await expect(dialog.locator(".margin-conversation-front")).toHaveCSS(
    "display",
    "none",
  );
  const close = dialog.getByRole("button", {
    name: "Back to post",
    exact: true,
  });
  await expect(close).toBeVisible();
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("keeps the animated live reply box above the mobile keyboard", async ({
  page,
  isMobile,
}, info) => {
  test.skip(!isMobile, "Mobile visual viewport");
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    let height = innerHeight;
    let top = 0;
    Object.defineProperties(viewport, {
      height: { get: () => height },
      offsetTop: { get: () => top },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.addEventListener("test:conversation-viewport", (event) => {
      const detail = (event as CustomEvent<{ height: number; top: number }>)
        .detail;
      height = detail.height;
      top = detail.top;
      viewport.dispatchEvent(new Event("resize"));
    });
  });
  await discussion(page);
  await page.goto("/preview/auth?view=member&area=profile");
  const trigger = page.getByRole("button", { name: /^Conversation on/ });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: /^Conversation on/ });
  await expect(page.locator("article")).toHaveAttribute("data-phase", "open");
  await dialog
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill("A mobile reply");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("test:conversation-viewport", {
        detail: { height: 420, top: 24 },
      }),
    ),
  );
  const submit = dialog
    .locator(".margin-conversation-composer")
    .getByRole("button", { name: "Post", exact: true });
  await expect
    .poll(async () => {
      const bounds = (await submit.boundingBox())!;
      return bounds.y + bounds.height;
    })
    .toBeLessThanOrEqual(444);
  await expect(dialog.locator(".margin-conversation-header")).toBeInViewport();
  await captureScreenshot(page, {
    path: info.outputPath("live-conversation-keyboard.png"),
    caret: "initial",
  });
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
