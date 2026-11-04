import { captureScreenshot, test, expect } from "./fixtures";

test("favicon head links select the matching monogram for light and dark mode", async ({
  page,
  request,
}, info) => {
  await page.goto("/welcome");
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const media = `(prefers-color-scheme: ${theme})`;
    const link = page.locator(`head link[rel="icon"][media="${media}"]`);
    await expect(link).toHaveAttribute("type", "image/svg+xml");
    await expect(link).toHaveAttribute("sizes", "any");
    await expect(link).toHaveAttribute("href", `/icon?theme=${theme}`);
    expect(
      await page.evaluate((query) => matchMedia(query).matches, media),
    ).toBe(true);
    const response = await request.get((await link.getAttribute("href"))!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
    expect(await response.text()).toContain(
      `fill="${theme === "light" ? "#454D24" : "#B9C65A"}"`,
    );
  }
  await expect(page.locator('head link[rel="shortcut icon"]')).toHaveAttribute(
    "href",
    "/icon",
  );
  const apple = page.locator('head link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("sizes", "180x180");
  const response = await request.get((await apple.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const origin = new URL(page.url()).origin;
  await page.setContent(
    `<main style="display:flex;flex-wrap:wrap;gap:24px;padding:24px;background:#ddd"><section style="display:flex;align-items:center;gap:20px;padding:24px;background:#fff">${[16, 32, 96].map((size) => `<img alt="Light icon ${size}px" src="${origin}/icon?theme=light" width="${size}" height="${size}">`).join("")}</section><section style="display:flex;align-items:center;gap:20px;padding:24px;background:#30383D">${[16, 32, 96].map((size) => `<img alt="Dark icon ${size}px" src="${origin}/icon?theme=dark" width="${size}" height="${size}">`).join("")}</section></main>`,
  );
  expect(
    await page.locator("img").evaluateAll(async (images) => {
      await Promise.all(
        images.map((image) => (image as HTMLImageElement).decode()),
      );
      return images.every(
        (image) => (image as HTMLImageElement).naturalWidth > 0,
      );
    }),
  ).toBe(true);
  await captureScreenshot(page.locator("main"), {
    path: info.outputPath("favicon-light-dark.png"),
  });
});
