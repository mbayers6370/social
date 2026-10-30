import { expect, test } from "./fixtures";
test("centers empty conversation copy and keeps menu buttons compact", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Conversation fixtures are development-only",
  );
  await page.goto("/");
  await page.locator("#post-book [data-conversation-trigger]").click();
  await expect(page.locator("#post-book")).toHaveAttribute(
    "data-phase",
    "open",
  );
  const dialog = page.getByRole("dialog", { name: /Conversation on/ });
  const empty = dialog.getByText(
    "No comments yet. Be the first to leave a thought.",
    { exact: true },
  );
  await expect(empty).toBeVisible();
  await expect(empty).toHaveCSS("font-size", "14px");
  await expect(empty).toHaveCSS("color", "rgb(105, 110, 113)");
  const center = await empty.evaluate((node) => {
    const viewport = node.closest(".margin-conversation-scroll")!;
    const summary = viewport.querySelector(".margin-post-summary")!;
    const bounds = viewport.getBoundingClientRect();
    const top =
      getComputedStyle(summary).display === "none"
        ? bounds.top
        : summary.getBoundingClientRect().bottom;
    const range = document.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    return {
      expected: (top + bounds.bottom) / 2,
      actual: text.y + text.height / 2,
    };
  });
  expect(Math.abs(center.expected - center.actual)).toBeLessThan(2);
  await page.screenshot({
    path: `test-results/empty-centered-${testInfo.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  const menu = page.getByRole("navigation", {
    name: "Profile menu",
    exact: true,
  });
  await menu.evaluate(async (node) => {
    await Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  const signin = menu.getByRole("link", { name: "Sign in", exact: true });
  const exit = menu.getByRole("button", { name: "Exit preview", exact: true });
  const first = (await signin.boundingBox())!,
    second = (await exit.boundingBox())!;
  expect(Math.abs(first.y - second.y)).toBeLessThan(1);
  expect(second.x).toBeGreaterThanOrEqual(first.x + first.width + 7);
  for (const action of [signin, exit]) {
    await expect(action).toHaveCSS("justify-content", "center");
    await expect(action).toHaveCSS("border-top-width", "1px");
  }
  expect(first.height).toBeGreaterThanOrEqual(44);
  expect(second.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: `test-results/menu-buttons-${testInfo.project.name}.png`,
  });
});
