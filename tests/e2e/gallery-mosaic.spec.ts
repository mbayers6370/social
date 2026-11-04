import { expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

for (const area of ["profile", "gallery"]) {
  test(`${area} featured photos fill the one, two and three-photo compositions`, async ({
    page,
  }, info) => {
    test.skip(
      process.env.PLAYWRIGHT_PRODUCTION === "1",
      "Development fixtures",
    );
    await memberFixture(page);
    for (const count of [1, 2, 3]) {
      await page.goto(
        `/preview/auth?view=member&area=${area}-featured-${count}`,
      );
      const mosaic = page.locator(".margin-gallery-mosaic");
      await expect(mosaic).toHaveAttribute("data-count", String(count));
      await expect(mosaic.locator("img")).toHaveCount(count);
      await expect
        .poll(() =>
          mosaic
            .locator("img")
            .evaluateAll((nodes) =>
              nodes.every(
                (node) => (node as HTMLImageElement).naturalWidth > 0,
              ),
            ),
        )
        .toBe(true);
      const geometry = await mosaic.evaluate((node) => {
        const rect = (element: Element) => {
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
            right: box.right,
            bottom: box.bottom,
          };
        };
        return {
          frame: rect(node),
          cells: Array.from(node.children).map(rect),
          images: Array.from(node.querySelectorAll("img")).map((image) => ({
            ...rect(image),
            fit: getComputedStyle(image).objectFit,
          })),
        };
      });
      const { frame, cells, images } = geometry;
      expect(cells[0].x).toBeCloseTo(frame.x, 1);
      for (const [index, image] of images.entries()) {
        expect(image.width).toBeCloseTo(cells[index].width, 1);
        expect(image.height).toBeCloseTo(cells[index].height, 1);
        expect(image.fit).toBe("cover");
        expect(image.bottom).toBeLessThanOrEqual(frame.bottom + 1);
      }
      if (count === 1) {
        expect(cells[0].width).toBeCloseTo(frame.width, 1);
        expect(cells[0].height).toBeCloseTo(frame.height, 1);
      } else if (count === 2) {
        expect(cells[0].y).toBeCloseTo(cells[1].y, 1);
        expect(cells[0].width).toBeCloseTo(cells[1].width, 1);
        expect(cells[1].right).toBeCloseTo(frame.right, 1);
        expect(cells[0].height).toBeCloseTo(frame.height, 1);
      } else {
        expect(cells[0].height).toBeCloseTo(frame.height, 1);
        expect(cells[0].width).toBeGreaterThan(cells[1].width);
        expect(cells[1].x).toBeCloseTo(cells[2].x, 1);
        expect(cells[1].y).toBeCloseTo(cells[0].y, 1);
        expect(cells[2].y).toBeGreaterThan(cells[1].bottom);
        expect(cells[1].height).toBeCloseTo(cells[2].height, 1);
        expect(cells[2].bottom).toBeCloseTo(frame.bottom, 1);
      }
      await mosaic.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: info.outputPath(`${area}-${count}-photos.png`),
      });
    }
  });
}
