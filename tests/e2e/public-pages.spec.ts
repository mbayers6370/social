import { captureScreenshot, expect, test } from "./fixtures";

test("mobile commitments stay still, centered on one line, and scroll without controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/welcome");
  const banner = page.locator(".margin-welcome-commitments");
  const track = page.locator(".margin-welcome-commitments-track");
  const viewport = page.getByRole("region", {
    name: "Margin commitments",
    exact: true,
  });
  const list = banner.getByRole("list", { name: "What’s different" });
  await expect(list.getByRole("listitem")).toHaveCount(5);
  await expect(track.locator("ul")).toHaveCount(1);
  await expect(track).toHaveCSS("animation-name", "none");
  await expect(banner.getByRole("button")).toHaveCount(0);
  await page.setViewportSize({ width: 385, height: 850 });
  await expect(viewport).toHaveCSS("overflow-x", "auto");
  await expect(track).toHaveCSS("animation-name", "none");
  const rows = await track.locator("ul").evaluateAll((nodes) =>
    nodes.map((node) => ({
      display: getComputedStyle(node).display,
      direction: getComputedStyle(node).flexDirection,
      count: node.children.length,
    })),
  );
  expect(rows).toEqual([{ display: "flex", direction: "row", count: 5 }]);
  const centers = await viewport.evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return Array.from(node.querySelectorAll("li")).map((item) => {
      const rect = item.getBoundingClientRect();
      return Math.abs(
        rect.top + rect.height / 2 - bounds.top - node.clientHeight / 2,
      );
    });
  });
  for (const distance of centers) expect(distance).toBeLessThan(1);
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => viewport.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(track).toHaveCSS("animation-name", "none");
  const last = list.getByRole("listitem").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    await page.emulateMedia({ reducedMotion });
    await expect(track).toHaveCSS("animation-name", "none");
    await expect(list.getByRole("listitem")).toHaveCount(5);
  }
  await page.evaluate(
    () => (document.documentElement.dataset.motion = "reduced"),
  );
  await expect(track).toHaveCSS("animation-name", "none");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(385);
});

test("visitors can explore, open an invitation and recover a waitlist submission", async ({
  page,
}, testInfo) => {
  await page.goto("/welcome");
  const navigation = page.getByRole("navigation", {
    name: "Public navigation",
  });
  for (const name of [
    "Why Margin",
    "How it works",
    "Sign in",
    "Have an invitation?",
  ])
    await expect(
      navigation.getByRole("link", { name, exact: true }),
    ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
    0,
  );
  await captureScreenshot(page, {
    path: testInfo.outputPath("welcome-visitor.png"),
    fullPage: true,
  });
  await page
    .locator(".margin-welcome-actions")
    .getByRole("link", { name: "See how it feels" })
    .click();
  await expect(page).toHaveURL(/#welcome-preview$/);
  const target = page.locator("#welcome-preview");
  await expect(target).toHaveAttribute(
    "aria-label",
    "Messages between friends",
  );
  if ((page.viewportSize()?.width ?? 0) < 768) {
    expect((await target.boundingBox())!.y).toBeLessThan(150);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page
      .getByRole("link", { name: "See how it feels", exact: true })
      .click();
    expect((await target.boundingBox())!.y).toBeLessThan(150);
    const intro = await page
      .locator(".margin-welcome-opening .margin-public-intro")
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    const title = await page
      .locator(".margin-public-hero h1")
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(intro / title).toBeLessThan(0.5);
  }
  await expect(
    page.locator(".margin-brand-link .margin-brand-corner-start"),
  ).toHaveCSS("color", "rgb(153, 150, 78)");
  await expect(page.locator('[data-crop="face"] img')).toHaveCSS(
    "object-position",
    "50% 0%",
  );
  await expect(page.locator(".margin-welcome-outside figcaption")).toHaveCSS(
    "font-weight",
    "500",
  );
  for (const card of await page.locator(".margin-welcome-basics > li").all()) {
    await expect(card).toHaveCSS("background-color", "rgb(252, 251, 250)");
    await expect(card).toHaveCSS(
      "border-top-color",
      await page
        .locator(".margin-welcome-message-thread")
        .evaluate((node) => getComputedStyle(node).borderTopColor),
    );
    await expect(card.locator("h3")).toHaveCSS("color", "rgb(119, 117, 54)");
  }
  await expect(page.locator(".margin-welcome-connection-band")).toHaveCSS(
    "background-color",
    "rgb(238, 237, 231)",
  );
  await expect(page.locator(".margin-welcome-overview")).toHaveCount(0);
  const footer = page.getByRole("navigation", { name: "Footer", exact: true });
  await expect(
    footer.getByRole("heading", { name: "Your information" }),
  ).toBeVisible();

  // UI recovery double. Persistence and deduplication use real isolated PostgreSQL tests.
  let attempts = 0;
  await page.route("**/api/waitlist", (route) =>
    route.fulfill({
      status: ++attempts === 1 ? 503 : 202,
      contentType: "application/json",
      body:
        attempts === 1
          ? JSON.stringify({ error: "Please try again." })
          : JSON.stringify({ saved: true }),
    }),
  );
  await page
    .getByLabel("No invite yet? Leave your email.")
    .fill("visitor@example.invalid");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(
    page.getByRole("form", { name: "Invitation waitlist" }).getByRole("alert"),
  ).toHaveText("Please try again.");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByRole("status")).toContainText("You’re on the list.");
  await page.goto("/join");
  await page
    .getByLabel("Your invitation link")
    .fill("https://other.invalid/invite/" + "a".repeat(43));
  await page.getByRole("button", { name: "Open my invitation" }).click();
  await expect(
    page.locator(".margin-public-join-page").getByRole("alert"),
  ).toContainText("Paste the full Margin invitation link");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test(
  "closing invitation leads with two readable lines and membership information",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.goto("/welcome");
    const section = page.getByRole("region", {
      name: "For the people you think of first.",
    });
    const heading = section.getByRole("heading", { level: 2 });
    await section.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    const lines = await heading.evaluate(
      (node) =>
        node.getBoundingClientRect().height /
        parseFloat(getComputedStyle(node).lineHeight),
    );
    expect(lines).toBeCloseTo(2, 1);
    const note = section.getByText(
      "A friend sends you a personal invitation link. Open it to create your account and join them on Margin.",
      { exact: true },
    );
    expect((await note.boundingBox())!.y).toBeGreaterThan(
      (await heading.boundingBox())!.y,
    );
    await expect(
      section.getByRole("button", { name: "Join the waitlist" }),
    ).toHaveCount(1);
    await expect(
      section.getByRole("link", { name: "How invitations work" }),
    ).toHaveCount(0);
    await expect(section.locator('a[href="/sign-up"]')).toHaveCount(0);
    await captureScreenshot(section, {
      path: testInfo.outputPath("personal-invitation.png"),
    });
  },
);

test(
  "welcome refinements keep invitation copy, compact font punctuation and the differences strip",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.goto("/welcome");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".margin-welcome-cta")).toHaveText(
      "Membership by invitation",
    );
    await expect(
      page
        .getByRole("navigation", { name: "Footer" })
        .getByRole("link", { name: "Why Margin", exact: true }),
    ).toHaveAttribute("href", "/why-margin");
    await expect(
      page
        .getByRole("navigation", { name: "Public navigation" })
        .getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveCSS("font-weight", "600");
    const headingColor = await page
      .locator("#welcome-gallery-title")
      .evaluate((node) => getComputedStyle(node).color);
    await expect(page.locator(".margin-public-hero")).toHaveCSS(
      "background-color",
      "rgb(40, 40, 32)",
    );
    await expect(page.locator("#public-title")).toHaveCSS(
      "color",
      "rgb(250, 249, 246)",
    );
    await expect(page.locator("#welcome-connection-title")).toHaveCSS(
      "color",
      "rgb(40, 40, 32)",
    );
    for (const id of ["welcome-gallery-title", "welcome-joining-title"])
      await expect(page.locator(`#${id}`)).toHaveCSS("color", headingColor);
    const strip = page.getByRole("list", { name: "What’s different" });
    await expect(strip.getByRole("listitem")).toHaveText([
      "No like counts in the feed",
      "No ads",
      "No algorithm",
      "Posts disappear after 30 days",
      "Up to three posts a day",
    ]);
    expect((await strip.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await page.locator(".margin-welcome-connection").boundingBox())!.y +
        (await page.locator(".margin-welcome-connection").boundingBox())!
          .height,
    );
    expect(
      (await page.locator(".margin-welcome-gallery-section").boundingBox())!.y,
    ).toBeGreaterThanOrEqual(
      (await strip.boundingBox())!.y + (await strip.boundingBox())!.height,
    );
    const widths = await page.locator("#public-title").evaluate((node) => {
      const context = document.createElement("canvas").getContext("2d")!;
      context.font = `300 40px ${getComputedStyle(node).fontFamily}`;
      return Object.fromEntries(
        [" ", "’", ",", ".", "…"].map((char) => [
          char,
          context.measureText(char).width,
        ]),
      );
    });
    for (const char of ["’", ",", "."])
      expect(widths[char]).toBeLessThan(widths[" "]);
    // Canvas glyph advances can round separately by one pixel across platforms.
    expect(Math.abs(widths["…"] - 3 * widths["."])).toBeLessThanOrEqual(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await captureScreenshot(page, {
      path: testInfo.outputPath("welcome-refinements.png"),
      fullPage: true,
    });
  },
);

test(
  "hero keeps headline, introduction and invitation in reading order at every breakpoint",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome");
    for (const width of [390, 820, 1023, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      const opening = page.locator(".margin-welcome-opening");
      const hero = (await page.locator(".margin-public-hero").boundingBox())!;
      const group = (await opening.boundingBox())!;
      expect(
        Math.abs(group.x + group.width / 2 - (hero.x + hero.width / 2)),
      ).toBeLessThan(1);
      await expect(opening).toHaveCSS("text-align", "center");
      const title = (await opening.locator("h1").boundingBox())!;
      const intro = (await opening
        .locator(".margin-public-intro")
        .boundingBox())!;
      const action = (await opening
        .locator(".margin-welcome-cta")
        .boundingBox())!;
      expect(intro.y).toBeGreaterThanOrEqual(title.y + title.height);
      expect(action.y).toBeGreaterThanOrEqual(intro.y + intro.height);
      const preview = (await page.locator("#welcome-preview").boundingBox())!;
      expect(preview.y).toBeGreaterThan(hero.y + hero.height);
      if (width === 820) {
        expect(group.width).toBeLessThan(1000);
        await captureScreenshot(page, {
          path: testInfo.outputPath("tablet-hero.png"),
        });
      }
    }
  },
);

test("public documents keep their content readable and their section links usable", async ({
  page,
}, testInfo) => {
  for (const route of ["why-margin", "help", "privacy"]) {
    await page.goto(`/${route}`);
    const article = page.locator(".margin-public-document");
    await expect(article.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    await captureScreenshot(page, {
      path: testInfo.outputPath(`${route}.png`),
    });
    const link = page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link")
      .first();
    const target = await link.getAttribute("href");
    await link.click();
    await expect(
      page.locator(target!).getByRole("heading", { level: 2 }),
    ).toBeInViewport();
    if (route === "privacy") {
      const note = page.getByRole("complementary", {
        name: "Policy draft status",
      });
      await expect(note).toContainText("not an active agreement");
      await expect(
        note.getByRole("link", { name: "support@margin.social" }),
      ).toBeVisible();
    }
  }
});

test("welcome keeps its messages and gallery layout usable across screen sizes", async ({
  page,
  isMobile,
}, testInfo) => {
  await page.goto("/welcome");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.fonts.ready);
  for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
    const photos = page.locator(".margin-welcome-gallery-photo");
    await expect(photos).toHaveCount(3);
    const frames = await photos.evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      }),
    );
    if (width < 768) {
      expect(frames[1].top).toBeGreaterThan(frames[0].bottom);
      expect(frames[2].top).toBeGreaterThan(frames[1].bottom);
    } else {
      expect(
        Math.max(...frames.map((r) => r.top)) -
          Math.min(...frames.map((r) => r.top)),
      ).toBeLessThan(1);
      expect(
        Math.max(...frames.map((r) => r.width)) -
          Math.min(...frames.map((r) => r.width)),
      ).toBeLessThan(1);
    }
    if (width === 1440 || width === 390) {
      await captureScreenshot(page.locator(".margin-welcome-connection"), {
        path: testInfo.outputPath(`welcome-${width}.png`),
      });
    }
  }
  await page.evaluate(
    () => (document.documentElement.dataset.readingSize = "extra-large"),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});

test("public pages expose the footer, practical rules and draft policies on desktop and mobile", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A feed that ends. Imagine.",
  );
  const hero = page.locator(".margin-public-hero");
  await expect(
    page.getByRole("figure", { name: "Feed and conversation" }),
  ).toHaveCount(0);
  await expect(page.getByText("All caught up.", { exact: true })).toHaveCount(
    0,
  );
  const messageBounds = (await page
    .getByRole("figure", { name: "Messages between friends" })
    .boundingBox())!;
  const heroBounds = (await hero.boundingBox())!;
  const layoutBounds = (await page
    .locator(".margin-welcome-connection")
    .boundingBox())!;
  const viewport = await page.evaluate(() => ({
    left: document.body.getBoundingClientRect().left,
    width: document.body.getBoundingClientRect().width,
    gutter: parseFloat(
      getComputedStyle(document.querySelector(".margin-public-header")!)
        .paddingLeft,
    ),
  }));
  const contentWidth = Math.min(1120, viewport.width - 2 * viewport.gutter);
  expect(
    Math.abs(
      layoutBounds.x - viewport.left - (viewport.width - contentWidth) / 2,
    ),
  ).toBeLessThan(1);
  expect(Math.abs(layoutBounds.width - contentWidth)).toBeLessThan(1);
  expect(messageBounds.y).toBeGreaterThan(heroBounds.y + heroBounds.height);
  await expect(hero.getByRole("figure")).toHaveCount(0);
  await expect(hero.locator(".margin-public-intro")).toHaveText(
    "A private social space for the people you actually know. Invite-only. Three posts a day. No ads, no algorithm.",
  );
  await expect(
    page.getByRole("link", { name: "A different kind of social" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  await page.locator(".margin-welcome-cta").click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await page.goto("/how-it-works");
  const footer = page.getByRole("navigation", { name: "Footer", exact: true });
  await footer.getByRole("link", { name: "How it works" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How Margin works",
  );
  await expect(
    page.getByText(
      "Comments and private messages do not count toward this limit.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/minimum signup age is 18/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Footer", exact: true })
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Policy draft status" }),
  ).toContainText("support@margin.social");
  await expect(
    page.getByRole("complementary", { name: "Policy draft status" }),
  ).toContainText("not an active agreement");
  expect(await page.locator("form, iframe, audio, video").count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("welcome copy and message illustration match the product", async ({
  page,
}, info) => {
  await page.goto("/welcome");
  await page.evaluate(() => document.fonts.ready);
  const strip = page.getByRole("list", { name: "What’s different" });
  await expect(strip.getByRole("listitem")).toHaveText([
    "No like counts in the feed",
    "No ads",
    "No algorithm",
    "Posts disappear after 30 days",
    "Up to three posts a day",
  ]);
  const header = page.locator(".margin-welcome-message-thread > header");
  await expect(header).toContainText("Robin Lee");
  await expect(header).toContainText("View profile");
  await expect(header.getByText("Messages", { exact: true })).toHaveCount(0);
  await expect(header.locator(":scope > svg")).toHaveCount(0);
  await expect(page.locator(".margin-welcome-message-afterword")).toHaveCount(
    0,
  );
  await captureScreenshot(page.locator(".margin-welcome-message-stage"), {
    path: info.outputPath("welcome-message-caption.png"),
  });
});
