import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1" ||
      testInfo.project.name === "mobile",
    "Desktop conversation layout in the development feed",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
});

test("mutes the selected post surface without dimming its photographs", async ({
  page,
}, testInfo) => {
  const post = page.locator("#post-porch");
  const original = await post.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    text: getComputedStyle(node.querySelector(".margin-post-prose")!).color,
  }));
  await post.locator("[data-conversation-trigger]").click();
  await expect(post).toHaveAttribute("data-phase", "open");
  const muted = await post.evaluate((node) => ({
    background: getComputedStyle(node).backgroundColor,
    text: getComputedStyle(node.querySelector(".margin-post-prose")!).color,
  }));
  expect(muted.background).not.toBe(original.background);
  expect(muted.text).not.toBe(original.text);
  const imageEffects = await post.locator("img").evaluateAll((images) =>
    images.flatMap((image) => {
      const effects = [];
      for (
        let element: Element | null = image;
        element;
        element = element.parentElement
      ) {
        const style = getComputedStyle(element);
        effects.push({ opacity: style.opacity, filter: style.filter });
        if (element.classList.contains("margin-feed-post")) break;
      }
      return effects;
    }),
  );
  expect(imageEffects.length).toBeGreaterThan(0);
  for (const effect of imageEffects)
    expect(effect).toEqual({ opacity: "1", filter: "none" });
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("muted-post-pair.png"),
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(post).toHaveCSS("background-color", original.background);
});

test("keeps the editor reachable when a tall profile post flips into its conversation", async ({
  page,
}, testInfo) => {
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  const composer = page.locator(
    ".margin-compose-inline, .margin-compose-dialog",
  );
  const paragraph =
    "A longer entry still deserves enough room to read and reply. ".repeat(5);
  await composer
    .getByRole("textbox", { name: "Your post" })
    .fill(Array.from({ length: 8 }, () => paragraph.trim()).join("\n\n"));
  await composer.getByRole("button", { name: "Publish" }).click();
  await expect(composer).not.toBeVisible();
  await expect(page).toHaveURL(/\?view=profile#post-local-/);
  const post = page.locator(`#${new URL(page.url()).hash.slice(1)}`);
  await expect(post).toContainText(paragraph.trim());
  const original = (await post.boundingBox())!;
  expect(original.height).toBeGreaterThan(900);
  await post.locator("[data-conversation-trigger]").scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => scrollY);
  await post.locator("[data-conversation-trigger]").click();
  await expect(post).toHaveAttribute("data-phase", "open");
  const dialog = page.getByRole("dialog");
  const panel = (await dialog.boundingBox())!;
  await expect(dialog).toHaveAttribute("data-layout", "inline-flip");
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  expect(panel.height).toBeCloseTo(640, 1);
  const slot = (await post.locator("..").boundingBox())!;
  expect(slot.height).toBeCloseTo(panel.height, 1);
  expect(slot.width).toBeCloseTo(panel.width, 1);
  await expect(
    dialog.getByRole("button", { name: "Back to post" }),
  ).toBeVisible();
  const input = dialog.getByRole("textbox", { name: "Add a comment" });
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport();
  const collapsed = (await dialog
    .locator(".margin-comment-input")
    .boundingBox())!;
  await input.click();
  const expanded = (await dialog
    .locator(".margin-comment-input")
    .boundingBox())!;
  expect(expanded.width).toBeCloseTo(collapsed.width, 1);
  expect(expanded.y).toBeLessThan(collapsed.y);
  expect(expanded.y + expanded.height).toBeCloseTo(
    collapsed.y + collapsed.height,
    1,
  );
  await expect(dialog.locator(".margin-conversation-footer")).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Post", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("tall-profile-flip-editor.png"),
  });
  await input.fill("A reply from the bottom of a tall post.");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("isn’t saved");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(post.locator("[data-conversation-trigger]")).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollBefore, 0);
});
