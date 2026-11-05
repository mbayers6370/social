import path from "node:path";
import { readFile } from "node:fs/promises";
import { captureScreenshot, test, expect } from "./fixtures";

test.beforeEach(() =>
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local Space composer"),
);

test("shares feed entry typography and preserves a text/photo draft until one Publish", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
  const appearance = await page
    .getByRole("group", { name: "Create a post", exact: true })
    .evaluate((node) => {
      const style = getComputedStyle(node);
      const prompt = getComputedStyle(
        node.querySelector(".margin-feed-compose-prompt")!,
      );
      return {
        padding: style.padding,
        font: prompt.font,
        color: prompt.color,
      };
    });
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    })
    .getByRole("link", { name: "Spaces", exact: true })
    .click();
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  const entry = page.getByRole("group", {
    name: "Share with this Space",
    exact: true,
  });
  await expect(entry).toBeVisible();
  // Space entries retain their standalone outline; the main feed owns its
  // shared outer card. Their writing controls keep the same spacing and type.
  await expect(entry).toHaveCSS("border-top-width", "1px");
  await expect(entry).toHaveCSS("border-radius", "14px");
  const actual = await entry.evaluate((node) => {
    const style = getComputedStyle(node);
    const prompt = getComputedStyle(
      node.querySelector(".margin-feed-compose-prompt")!,
    );
    return {
      padding: style.padding,
      font: prompt.font,
      color: prompt.color,
    };
  });
  expect(actual).toEqual(appearance);
  const originalPosts = await page.getByRole("article").count();
  const prompt = entry.getByRole("button", { name: "Share a thought…" });
  await prompt.click();
  const surface =
    info.project.name === "mobile"
      ? page.getByRole("dialog", { name: "New Post", exact: true })
      : entry.getByRole("region", { name: "New Post", exact: true });
  await expect(surface).toBeVisible();
  if (info.project.name === "mobile") {
    const box = await surface.boundingBox();
    expect(Math.abs(box!.y)).toBeLessThan(2);
    expect(box!.width).toBeCloseTo(page.viewportSize()!.width, 0);
    expect(box!.height).toBeCloseTo(page.viewportSize()!.height, 0);
  }
  const text = page.getByLabel("Your post", { exact: true });
  await expect(text).toBeFocused();
  await expect(text).toHaveAttribute("rows", "3");
  await expect(
    surface.locator(".margin-compose-writing .margin-avatar"),
  ).toHaveCount(0);
  await text.fill("A thought to keep with our photographs.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(prompt).toBeFocused();
  await entry.getByRole("button", { name: "New photo post" }).click();
  for (const description of ["Our first photograph", "Our second photograph"]) {
    const picker = page.getByRole("dialog", { name: "Choose a photograph" });
    await expect(picker).toBeVisible();
    await picker
      .getByLabel("Or upload a new one")
      .setInputFiles(path.resolve("src/assets/fixtures/dog.jpg"));
    await picker.getByRole("button", { name: "Use photograph" }).click();
    await expect(picker).toHaveCount(0);
    if (description === "Our first photograph")
      await page.getByRole("button", { name: "Add photographs" }).click();
  }
  await expect(text).toHaveValue("A thought to keep with our photographs.");
  await expect(page.locator(".margin-compose-photos img")).toHaveCount(2);
  await expect(page.locator("article")).toHaveCount(originalPosts);
  await captureScreenshot(page, {
    path: info.outputPath("space-composer-open.png"),
    fullPage: info.project.name !== "mobile",
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await prompt.click();
  await expect(text).toHaveValue("A thought to keep with our photographs.");
  await expect(page.locator(".margin-compose-photos img")).toHaveCount(2);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const post = page
    .getByRole("article")
    .filter({ hasText: "A thought to keep with our photographs." });
  await expect(post).toBeVisible();
  await expect(post.locator(".margin-post-image")).toHaveCount(2);
  await expect(page.getByRole("article")).toHaveCount(originalPosts + 1);
  await expect(prompt).toBeFocused();
  await prompt.click();
  await expect(text).toHaveValue("");
  await expect(page.locator(".margin-compose-photos img")).toHaveCount(0);
});

test("opens a dropped photograph for review before publishing on desktop", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "The feed's file-drop entry is desktop only",
  );
  await page.goto("/preview/spaces");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
  await page.getByRole("link", { name: /The Reading Room/ }).click();
  const entry = page.getByRole("group", {
    name: "Share with this Space",
    exact: true,
  });
  const bytes = await readFile(path.resolve("src/assets/fixtures/dog.jpg"));
  await entry.evaluate(
    (node, bytes) => {
      const data = new DataTransfer();
      data.items.add(
        new File([new Uint8Array(bytes)], "dog.jpg", { type: "image/jpeg" }),
      );
      node.dispatchEvent(
        new DragEvent("drop", {
          dataTransfer: data,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [...bytes],
  );
  const picker = page.getByRole("dialog", { name: "Choose a photograph" });
  await expect(picker.getByText("dog.jpg", { exact: true })).toBeVisible();
  await picker.getByRole("button", { name: "Use photograph" }).click();
  await expect(page.locator(".margin-compose-photos img")).toHaveCount(1);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await entry.getByRole("button", { name: "Share a thought…" }).click();
  await expect(page.locator(".margin-compose-photos img")).toHaveCount(1);
});
