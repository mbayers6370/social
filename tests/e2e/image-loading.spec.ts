import { expect, test } from "./fixtures";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development fixture screens",
  ),
);

test("initial photo markup is eager with only the lead feed photo at high priority", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/")).text();
  const photos = [...html.matchAll(/<img\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => tag.includes('class="margin-post-image"'));
  expect(photos).toHaveLength(9);
  for (const photo of photos) expect(photo).toContain('loading="eager"');
  expect(
    photos.filter(
      (photo) =>
        photo.includes('fetchPriority="high"') ||
        photo.includes('fetchpriority="high"'),
    ),
  ).toHaveLength(1);
  await page.goto("/");
  for (const image of await page.locator(".margin-post-image").all())
    await expect(image).toHaveAttribute("loading", "eager");
});

test("photo viewer preserves source proportions and stays contained without dimension warnings", async ({
  page,
}, testInfo) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("has either width or height modified"))
      warnings.push(message.text());
  });
  await page.setViewportSize({ width: 738, height: 844 });
  await page.goto("/?view=profile");
  await page.locator("#post-fog [data-post-photo-trigger]").nth(2).click();
  const image = page.locator("[data-post-photo-viewer] img");
  await image.evaluate((node) => (node as HTMLImageElement).decode());
  await expect(image).toBeInViewport({ ratio: 1 });
  const dimensions = await image.evaluate((node) => {
    const photo = node as HTMLImageElement;
    const bounds = photo.getBoundingClientRect();
    return {
      width: bounds.width,
      height: bounds.height,
      // Optimized thumbnails can round one source dimension to a whole pixel.
      ratio:
        Number(photo.getAttribute("width")) /
        Number(photo.getAttribute("height")),
    };
  });
  expect(dimensions.width).toBeGreaterThan(100);
  expect(dimensions.width / dimensions.height).toBeCloseTo(dimensions.ratio, 2);
  const viewer = (await page
    .locator("[data-post-photo-viewer]")
    .boundingBox())!;
  const bounds = (await image.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(viewer.x);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    viewer.x + viewer.width + 1,
  );
  expect(bounds.y).toBeGreaterThanOrEqual(viewer.y);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(
    viewer.y + viewer.height + 1,
  );
  await expect(image).toHaveCSS("object-fit", "contain");
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("contained-photo.png"),
  });
  expect(warnings).toEqual([]);
});

test("real LCP image loading stays correct for tea anchors, reloads, history, profile and conversation images", async ({
  page,
}) => {
  const warnings: string[] = [];
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Largest Contentful Paint"))
      warnings.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    type ImagePaint = { src: string; loading: string };
    const target = window as unknown as { imagePaints: ImagePaint[] };
    target.imagePaints = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const element = (entry as PerformanceEntry & { element?: Element })
          .element;
        if (element instanceof HTMLImageElement)
          target.imagePaints.push({
            src: element.currentSrc || element.src,
            loading: element.loading,
          });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto("/#post-tea");
  const tea = page.locator("#post-tea .margin-post-image");
  await expect(tea).toBeInViewport();
  await expect(tea).toHaveAttribute("loading", "eager");
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (
              window as unknown as {
                imagePaints: { src: string; loading: string }[];
              }
            ).imagePaints.find((paint) => paint.src.includes("tea."))?.loading,
        ),
      { timeout: 10000 },
    )
    .toBe("eager");
  // Cover native scroll restoration on the plain feed URL as well as anchors.
  await page.evaluate(() => history.replaceState(history.state, "", "/"));
  const restoredY = await page.evaluate(() => scrollY);
  expect(restoredY).toBeGreaterThan(0);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => scrollY))
    .toBeCloseTo(restoredY, 0);
  await expect(tea).toBeInViewport();
  await expect
    .poll(() => tea.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.locator("#post-tea [data-conversation-trigger]").click();
  await expect(page.locator("#post-tea")).toHaveAttribute("data-phase", "open");
  for (const image of await page.getByRole("dialog").locator("img").all())
    await expect(image).toHaveAttribute("loading", "eager");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/?view=profile#profile-gallery-title");
  const gallery = page.locator(".margin-gallery-preview img");
  for (const image of await page.locator(".margin-profile img").all())
    await expect(image).toHaveAttribute("loading", "eager");
  await expect
    .poll(() =>
      gallery
        .first()
        .evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await page.goBack();
  await expect(page.locator("#post-tea")).toBeAttached();
  await expect(tea).toHaveAttribute("loading", "eager");
  expect(warnings).toEqual([]);
  expect(errors).toEqual([]);
});
