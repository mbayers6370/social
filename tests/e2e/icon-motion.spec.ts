import fs from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { test, expect } from "@playwright/test";
import {
  SendAnimated,
  NotebookAnimated,
} from "../../src/components/margin-icons";

test.beforeEach(async ({ page }) => {
  const css = await fs.readFile(
    "src/components/margin-icons/margin-icons.css",
    "utf8",
  );
  const send = renderToStaticMarkup(
    createElement(SendAnimated, { id: "send", size: 96, animate: true }),
  );
  const notebook = renderToStaticMarkup(
    createElement(NotebookAnimated, {
      id: "notebook",
      size: 96,
      animate: true,
    }),
  );
  await page.setContent(
    `<style>${css}</style><main>${send}${notebook}<button type="button" onclick="document.querySelectorAll('.margin-icon').forEach(svg=>{svg.dataset.animate='false';void svg.getBoundingClientRect();svg.dataset.animate='true';})">Replay</button></main>`,
  );
});

test("Send travels upward and right, shrinks, then restores a readable resting glyph", async ({
  page,
}) => {
  const geometry = await page.evaluate(() => {
    const glyph = document.querySelector<SVGGElement>("#send .margin-send")!;
    const animation = glyph.getAnimations()[0];
    animation.pause();
    const sample = (progress: number) => {
      animation.currentTime =
        Number(animation.effect!.getTiming().duration) * progress;
      const box = glyph.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        opacity: Number(getComputedStyle(glyph).opacity),
      };
    };
    return { start: sample(0), flight: sample(0.6), end: sample(1) };
  });
  expect(geometry.flight.x).toBeGreaterThan(geometry.start.x);
  expect(geometry.flight.y).toBeLessThan(geometry.start.y);
  expect(geometry.flight.width).toBeLessThan(geometry.start.width * 0.4);
  expect(geometry.flight.opacity).toBeLessThan(0.3);
  expect(geometry.end.width).toBeCloseTo(geometry.start.width, 2);
  expect(geometry.end.opacity).toBe(1);
  await page.getByRole("button", { name: "Replay" }).click();
  expect(
    await page
      .locator("#send .margin-send")
      .evaluate((glyph) => glyph.getAnimations()[0].playState),
  ).toBe("running");
});

test("Notebook turns a page across a stationary spine and respects both motion opt-outs", async ({
  page,
}) => {
  const geometry = await page.evaluate(() => {
    const book = document.querySelector<SVGSVGElement>("#notebook")!;
    const frame = book.querySelector<SVGPathElement>(":scope > path")!;
    const leaf = book.querySelector<SVGGElement>(".margin-page")!;
    const animation = leaf.getAnimations()[0];
    animation.pause();
    const frameBefore = frame.getBoundingClientRect().toJSON();
    const sample = (progress: number) => {
      animation.currentTime =
        Number(animation.effect!.getTiming().duration) * progress;
      const box = leaf.getBoundingClientRect();
      return {
        right: box.right,
        width: box.width,
        opacity: Number(getComputedStyle(leaf).opacity),
      };
    };
    const start = sample(0.12),
      edge = sample(0.5),
      left = sample(0.85),
      end = sample(1);
    const box = book.getBoundingClientRect();
    return {
      start,
      edge,
      left,
      end,
      spine: box.x + box.width / 2,
      frameBefore,
      frameAfter: frame.getBoundingClientRect().toJSON(),
    };
  });
  expect(geometry.edge.width).toBeLessThan(geometry.start.width * 0.15);
  expect(geometry.left.right).toBeLessThanOrEqual(geometry.spine + 1);
  expect(geometry.left.opacity).toBe(1);
  expect(geometry.end.opacity).toBe(0);
  expect(geometry.frameAfter).toEqual(geometry.frameBefore);
  await page.evaluate(() =>
    document.querySelectorAll<SVGElement>(".margin-icon").forEach((svg) => {
      svg.dataset.paused = "true";
    }),
  );
  await expect(page.locator("#notebook .margin-page")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#notebook .margin-page")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(page.locator("#send .margin-send")).toHaveCSS("opacity", "1");
  await page.evaluate(() =>
    document.querySelectorAll<SVGElement>(".margin-icon").forEach((svg) => {
      svg.dataset.paused = "false";
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#notebook .margin-page")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#notebook .margin-page")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(page.locator("#send .margin-send")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(page.locator("#send .margin-send")).toHaveCSS(
    "transform",
    "none",
  );
});
