import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";
test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development rendering fixture",
  );
  await memberFixture(page);
});
test("keeps profile post surfaces flat and mobile navigation portraits at icon size", async ({
  page,
  isMobile,
}, info) => {
  await page.goto("/preview/auth?view=member&area=profile");
  await expect(
    page.getByRole("button", { name: "Share a thought…" }),
  ).toHaveCount(0);
  const newPost = page.getByRole("button", { name: "New Post", exact: true });
  await newPost.click();
  await expect(
    page.getByRole("dialog", { name: "New Post", exact: true }),
  ).toBeVisible();
  const draft = page.getByRole("textbox", { name: "Your post", exact: true });
  await draft.fill("A profile draft");
  await page.keyboard.press("Escape");
  await expect(newPost).toBeFocused();
  await newPost.click();
  await expect(draft).toHaveValue("A profile draft");
  await page.keyboard.press("Escape");
  const post = page.getByRole("article").first();
  await expect(post).toHaveCSS("border-top-left-radius", "0px");
  await expect(post).toHaveCSS("border-top-right-radius", "0px");
  if (isMobile) {
    const avatar = page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "Profile", exact: true })
      .locator(".margin-avatar");
    await expect(avatar).toHaveCSS("width", "20px");
    await expect(avatar).toHaveCSS("height", "20px");
  }
  const photograph = post.getByRole("button", { name: /^View photograph/ });
  await photograph.click();
  const viewer = page.getByRole("dialog", {
    name: "Photographs from Sample Member’s post",
  });
  const image = viewer.getByRole("img");
  await expect(image).toHaveAttribute("alt", "A cup of tea on a table");
  await expect(image).toHaveAttribute("title", "A cup of tea on a table");
  await expect(viewer.locator("figcaption")).toHaveClass(/\bsr-only\b/);
  await expect(viewer.locator(".margin-photo-caption")).toHaveCount(0);
  await captureScreenshot(page, {
    path: info.outputPath("photo-description-hover.png"),
    caret: "initial",
  });
});
test("uses search semantics and a clear empty notification hierarchy", async ({
  page,
}, info) => {
  await page.goto("/preview/auth?view=member");
  await page.getByRole("button", { name: "Search profiles" }).click();
  const search = page.getByRole("search", { name: "Find a member" });
  await expect(
    search.getByRole("searchbox", { name: "Search members" }),
  ).toHaveAttribute("autocomplete", "off");
  await expect(search.locator('input[type="password"]')).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Notifications" });
  await expect(
    panel.getByRole("heading", { name: "You’re all caught up", level: 3 }),
  ).toBeVisible();
  await expect(
    panel.getByText("New activity will appear here.", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Mark all as read" }),
  ).toHaveCount(0);
  await captureScreenshot(page, {
    path: info.outputPath("notification-empty.png"),
    caret: "initial",
  });
});
