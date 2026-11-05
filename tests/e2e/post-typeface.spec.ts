import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
// Load the component through Next's supported CommonJS package entry points.
const loadComponent = createRequire(import.meta.url);
const { PostContent } = loadComponent(
  "../../src/features/feed/post-content.tsx",
) as typeof import("../../src/features/feed/post-content");
import type { FeedPost } from "../../src/features/feed/schema";

const sample = `0ctober 10, 2019 · OO00 · “The story”—‘October’ – she's / she’s / We’ve. I - n – M —`;
const post: FeedPost = {
  id: "post-typeface-check",
  author: {
    id: "typeface-check",
    name: "Type specimen",
    initials: "TS",
    tone: "paper",
  },
  createdAt: "2026-11-04T12:00:00Z",
  expiresAt: "2026-12-04T12:00:00Z",
  paragraphs: [sample],
  link: {
    title: "We’ve read “The story” — October 10, 2019",
    url: "https://example.com/story",
  },
  likes: 0,
  comments: [],
};

test.beforeEach(async ({ page }) => {
  const [fontCss, tokens, posts] = await Promise.all([
    fs.readFile("public/fonts/margin-aside/fonts.css", "utf8"),
    fs.readFile("src/styles/tokens.css", "utf8"),
    fs.readFile("src/features/feed/post-card.css", "utf8"),
  ]);
  await page.route("**/fonts/margin-aside/*.woff2", async (route) => {
    const filename = path.basename(new URL(route.request().url()).pathname);
    await route.fulfill({
      contentType: "font/woff2",
      body: await fs.readFile(path.join("public/fonts/margin-aside", filename)),
    });
  });
  await page.route("**/__post-typeface-check", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><meta charset="utf-8"><style>${fontCss.replaceAll('url("./', 'url("/fonts/margin-aside/')}${tokens}${posts}:root{--font-aside:"Margin Aside";--font-inter:Arial}body{font-family:var(--font-body);margin:24px}.weight{font-family:var(--font-post);font-size:16px;font-kerning:normal;font-synthesis:none;overflow-wrap:anywhere}</style><h2 class="margin-person-name">UI name stays in the body family</h2>${renderToStaticMarkup(createElement(PostContent, { post }))}${[300, 500, 700].map((w) => `<p class="weight" id="font-${w}" style="font-weight:${w}">${sample}</p>`).join("")}`,
    });
  });
  await page.goto("/__post-typeface-check");
  await page.evaluate(async () => {
    for (const weight of [300, 500, 700])
      await document.fonts.load(`${weight} 16px "Margin Aside"`);
    await document.fonts.ready;
  });
});

test("real post content uses Medium with kerning while UI text keeps its existing body family", async ({
  page,
}) => {
  await expect(page.locator(".margin-post-prose")).toHaveCSS(
    "font-weight",
    "500",
  );
  await expect(page.locator(".margin-post-prose")).toHaveCSS(
    "font-kerning",
    "normal",
  );
  await expect(page.locator(".margin-post-prose")).toHaveCSS(
    "font-family",
    '"Margin Aside"',
  );
  await expect(page.locator(".margin-post-link")).toHaveCSS(
    "font-family",
    '"Margin Aside"',
  );
  await expect(page.locator(".margin-person-name")).toHaveCSS(
    "font-family",
    /Arial/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const widths = await page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    context.font = '500 16px "Margin Aside"';
    return [
      "To",
      "Th",
      "Ta",
      "Te",
      "Yo",
      "Wa",
      "r.",
      "y.",
      "f.",
      "“T",
      "T”",
    ].map((pair) => {
      context.fontKerning = "none";
      const before = context.measureText(pair).width;
      context.fontKerning = "normal";
      return { pair, before, after: context.measureText(pair).width };
    });
  });
  for (const pair of widths)
    expect(pair.after, pair.pair).toBeLessThan(pair.before);
});

test("the 16px O/zero, quote and dash samples use only the custom font in every weight", async ({
  page,
}) => {
  const session = await page.context().newCDPSession(page);
  await session.send("DOM.enable");
  await session.send("CSS.enable");
  const document = await session.send("DOM.getDocument");
  for (const weight of [300, 500, 700]) {
    const node = await session.send("DOM.querySelector", {
      nodeId: document.root.nodeId,
      selector: `#font-${weight}`,
    });
    const result = await session.send("CSS.getPlatformFontsForNode", {
      nodeId: node.nodeId,
    });
    expect(result.fonts.length).toBeGreaterThan(0);
    for (const font of result.fonts) {
      expect(font.isCustomFont, `${weight}: ${font.familyName}`).toBe(true);
      expect(font.familyName).toContain("Margin Aside");
    }
  }
  await session.detach();
});
