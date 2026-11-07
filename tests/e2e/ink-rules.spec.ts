import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { test, expect } from "./fixtures";

const source = (file: string) => readFileSync(resolve(file), "utf8");
const mask = `data:image/svg+xml;base64,${Buffer.from(source("src/components/ui/ink-rule/dry-rule.svg")).toString("base64")}`;
const tokens = source("src/styles/tokens.css").replace(
  /url\("\.\.\/components\/ui\/ink-rule\/dry-rule\.svg"\)/,
  `url("${mask}")`,
);

test.beforeEach(async ({ page }) => {
  await page.route("**/__ink-rule-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta charset="utf-8"><style>${tokens}${source("src/styles/rules.css")}${source("src/features/compose/compose.css")}${source("src/components/layout/margin-shell.css")}*{box-sizing:border-box}body{margin:24px;background:transparent}.sample{height:16px;background:#454D24;mask:var(--divider-mask) left center/100% 16px no-repeat}.small{width:200px}.wide{width:800px}.edges{width:240px;height:40px;min-height:0;margin-top:24px;padding:0}.margin-compose-header{background:white}.margin-mobile-nav{position:relative;inset:auto;display:block;padding:0;background:#454D24}</style><div class="sample small"></div><div class="sample wide"></div><div class="margin-compose-header edges"></div><div class="margin-mobile-nav edges"></div>`,
    }),
  );
  await page.goto("/__ink-rule-check");
});

test("keeps dry ink grain and straight caps at different widths", async ({
  page,
}) => {
  const small = await page.locator(".small").screenshot({ scale: "css" });
  const wide = await page.locator(".wide").screenshot({ scale: "css" });
  const crop = (buffer: Buffer) =>
    sharp(buffer)
      .extract({ left: 24, top: 0, width: 128, height: 16 })
      .ensureAlpha()
      .raw()
      .toBuffer();
  expect(await crop(small)).toEqual(await crop(wide));
  const { data, info } = await sharp(small)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x: number, y: number) => [
    ...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3),
  ];
  expect(pixel(0, 8)).not.toEqual([255, 255, 255]);
  expect(pixel(199, 8)).not.toEqual([255, 255, 255]);
  expect(pixel(100, 0)).toEqual([255, 255, 255]);
  expect(pixel(100, 15)).toEqual([255, 255, 255]);
});

test("retains separator layout and shared gray/olive colors", async ({
  page,
}) => {
  const geometry = await page.locator(".edges").evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      const side = element.classList.contains("margin-compose-header")
        ? "::after"
        : "::before";
      const rule = getComputedStyle(element, side);
      return {
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        border:
          side === "::after" ? style.borderBottomWidth : style.borderTopWidth,
        color: rule.backgroundColor,
        mask: rule.maskImage,
        ruleHeight: rule.height,
      };
    }),
  );
  expect(geometry[0]).toMatchObject({
    width: 240,
    height: 40,
    border: "1px",
    color: "rgba(218, 218, 216, 0.65)",
    ruleHeight: "16px",
  });
  expect(geometry[1]).toMatchObject({
    width: 240,
    height: 40,
    border: "1px",
    color: "rgb(119, 117, 54)",
    ruleHeight: "16px",
  });
  for (const divider of geometry)
    expect(divider.mask).toContain("data:image/svg+xml");
});
