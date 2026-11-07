import { readFileSync } from "node:fs";
import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development UI fixtures",
  ),
);

test("borders olive action buttons consistently without boxing quiet controls", async ({
  page,
}, info) => {
  await page.goto("/design-system");
  for (const label of ["Primary action", "Unavailable"]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await expect(button).toHaveCSS("border-top-width", "1px");
    await expect(button).toHaveCSS("border-top-style", "solid");
    await expect(button).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  }
  await expect(
    page.getByRole("button", { name: "Quiet action", exact: true }),
  ).toHaveCSS("border-top-width", "0px");
  const primary = page.getByRole("button", {
    name: "Primary action",
    exact: true,
  });
  await expect(primary).toHaveCSS("border-top-color", "rgb(119, 117, 54)");
  await expect(primary).toHaveCSS("color", "rgb(250, 249, 246)");
  await expect(page.locator("html")).toHaveAttribute("data-reading-size", /.+/);
  await primary.focus();
  await expect(primary).toBeFocused();
  await primary.hover();
  await expect(primary).toHaveCSS("border-top-color", "rgb(119, 117, 54)");
  await captureScreenshot(page, {
    path: info.outputPath("button-borders.png"),
    fullPage: true,
  });
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=profile");
  await expect(
    page.getByRole("button", { name: "Search profiles", exact: true }),
  ).toHaveCSS("border-top-width", "0px");
  const newPost = page.getByRole("button", { name: "New Post", exact: true });
  await expect(newPost).toHaveCSS("border-top-width", "0px");
  await expect(newPost).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const target = (await newPost.boundingBox())!;
  expect(target.height).toBeGreaterThanOrEqual(44);
  const surface = await newPost.evaluate((button) => {
    const style = getComputedStyle(button, "::before");
    return {
      border: style.borderTopWidth,
      color: style.borderTopColor,
      background: style.backgroundColor,
      height: style.height,
    };
  });
  expect(surface).toEqual({
    border: "1px",
    color: "rgba(119, 117, 54, 0.55)",
    background: "rgb(119, 117, 54)",
    height: "32px",
  });
  await newPost.click();
  const publish = page.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toHaveCSS("border-top-color", "rgb(119, 117, 54)");
  await expect(publish).toHaveCSS("background-color", "rgb(119, 117, 54)");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCSS("border-top-width", "0px");
});

test("shows a device image during review and in a retained draft without uploading it", async ({
  page,
}, info) => {
  await memberFixture(page);
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/(posts|gallery)/.test(new URL(request.url()).pathname)
    )
      uploads.push(request.url());
  });
  await page.goto("/preview/auth?view=member");
  await page.getByRole("button", { name: "New photo post" }).click();
  const picker = page.getByRole("dialog", { name: "Choose a photograph" });
  await picker
    .getByLabel("Or upload a new one", { exact: true })
    .setInputFiles({
      name: "tea.jpg",
      mimeType: "image/jpeg",
      buffer: readFileSync("src/assets/fixtures/tea.jpg"),
    });
  const review = picker.locator(".margin-dropped-photo");
  await expect
    .poll(() =>
      review.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(review).toHaveCSS("object-fit", "contain");
  await expect(review).toHaveCSS("height", "220px");
  await picker
    .getByRole("button", { name: "Use photograph", exact: true })
    .click();
  const draft = page.locator(".margin-compose-photo > img");
  await draft.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      draft.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(draft).toHaveCSS("height", "160px");
  await expect(draft).toHaveCSS("object-fit", "contain");
  await captureScreenshot(page, {
    path: info.outputPath("photo-draft.png"),
    caret: "initial",
  });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Share a thought…" }).click();
  await expect
    .poll(() =>
      draft.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Remove photograph 1 from draft" })
    .click();
  await expect(draft).toHaveCount(0);
  expect(uploads).toEqual([]);
});

test("shows and replaces a gallery device preview before any upload", async ({
  page,
}, info) => {
  await memberFixture(page);
  const uploads: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/gallery/photo")
    )
      uploads.push(request.url());
  });
  await page.goto("/preview/auth?view=member&area=gallery");
  await page.getByRole("button", { name: "Add photo", exact: true }).click();
  const picker = page.getByRole("dialog", {
    name: "Add Photograph",
    exact: true,
  });
  await picker
    .getByLabel("Photograph", { exact: true })
    .setInputFiles("src/assets/fixtures/tea.jpg");
  const preview = picker.locator(".margin-dropped-photo");
  await expect
    .poll(() =>
      preview.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const original = await preview.getAttribute("src");
  await picker
    .getByLabel("Photograph", { exact: true })
    .setInputFiles("src/assets/fixtures/dog.jpg");
  await expect(preview).not.toHaveAttribute("src", original!);
  await expect
    .poll(() =>
      preview.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await captureScreenshot(page, {
    path: info.outputPath("gallery-device-preview.png"),
    caret: "initial",
  });
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(picker).toHaveCount(0);
  expect(uploads).toEqual([]);
});
