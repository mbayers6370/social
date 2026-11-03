import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const directory = path.resolve("public/fonts/margin");

test.beforeEach(async ({ page }) => {
  // Real package files, served directly to isolate font checks from account/auth services.
  await page.route("**/fonts/margin/*", async (route) => {
    const filename = path.basename(new URL(route.request().url()).pathname);
    const mime: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".js": "text/javascript",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".json": "application/json",
    };
    await route.fulfill({
      contentType: mime[path.extname(filename)],
      body: await fs.readFile(path.join(directory, filename)),
    });
  });
  await page.goto("/fonts/margin/specimen.html");
  await page.evaluate(() => document.fonts.ready);
});

test("six real font faces render at distinct weights and preserve their spacing contracts", async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 180;
    const ctx = canvas.getContext("2d")!;
    function ink(family: string, weight: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${weight} 96px "${family}"`;
      ctx.fillText("margin Hinge 012345", 10, 120);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let index = 3; index < pixels.length; index += 4)
        sum += pixels[index];
      return sum;
    }
    const families = ["Margin Hinge", "Margin Loose Mono"];
    const coverage = [...document.fonts].map((font) => ({
      family: font.family,
      weight: font.weight,
      status: font.status,
    }));
    const masses = families.map((family) =>
      [300, 500, 700].map((weight) => ink(family, weight)),
    );
    ctx.font = '500 48px "Margin Loose Mono"';
    const monoWidths = ["iiii", "WWWW", "....", "éééé"].map(
      (text) => ctx.measureText(text).width,
    );
    ctx.font = '500 48px "Margin Hinge"';
    ctx.fontKerning = "none";
    const unkerned = ctx.measureText("AV").width;
    ctx.fontKerning = "normal";
    const kerned = ctx.measureText("AV").width;
    return { coverage, masses, monoWidths, unkerned, kerned };
  });
  expect(result.coverage).toHaveLength(6);
  expect(result.coverage.every((font) => font.status === "loaded")).toBe(true);
  for (const [light, medium, bold] of result.masses) {
    expect(light).toBeGreaterThan(0);
    expect(medium).toBeGreaterThan(light * 1.25);
    expect(bold).toBeGreaterThan(medium * 1.15);
  }
  for (const width of result.monoWidths)
    expect(width).toBeCloseTo(result.monoWidths[0], 4);
  expect(result.kerned).toBeLessThan(result.unkerned);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the specimen edits every sample and changes size without replacing a font face", async ({
  page,
}) => {
  await page
    .getByLabel("Try your own words")
    .fill("Margin — Café & conversations 2026");
  await expect(page.locator(".sample")).toHaveCount(6);
  for (const sample of await page.locator(".sample").all())
    await expect(sample).toHaveText("Margin — Café & conversations 2026");
  await page.getByRole("slider").fill("48");
  await expect(page.locator("#size-value")).toHaveText("48 px");
  await expect(page.locator(".sample").first()).toHaveCSS("font-size", "48px");
  await expect(
    page.getByRole("link", { name: "TTF", exact: true }),
  ).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "WOFF2", exact: true }),
  ).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
