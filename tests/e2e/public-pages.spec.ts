import { captureScreenshot, expect, test } from "./fixtures";

test(
  "closing invitation leads with two readable lines and membership information",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.goto("/welcome");
    const section = page.getByRole("region", {
      name: "For the people you think of first.",
    });
    const heading = section.getByRole("heading");
    await section.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
    const lines = await heading.evaluate(
      (node) =>
        node.getBoundingClientRect().height /
        parseFloat(getComputedStyle(node).lineHeight),
    );
    expect(lines).toBeCloseTo(2, 1);
    const note = section.getByText(
      "Margin grows through invitations from existing members. Open a link from someone you know to begin.",
      { exact: true },
    );
    expect((await note.boundingBox())!.y).toBeGreaterThan(
      (await heading.boundingBox())!.y,
    );
    await expect(section.getByRole("button")).toHaveCount(0);
    await expect(
      section.getByRole("link", { name: "Membership by invitation" }),
    ).toHaveAttribute("href", "/how-it-works");
    await expect(section.locator('a[href="/sign-up"]')).toHaveCount(0);
    await captureScreenshot(section, {
      path: testInfo.outputPath("personal-invitation.png"),
    });
  },
);

test("conversation control sits at the top right and keeps keyboard access", async ({
  page,
}, testInfo) => {
  await page.goto("/welcome");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const front = page.locator(".margin-welcome-post-front");
  const button = page.getByRole("button", { name: "Open conversation" });
  await expect(button).toHaveText("Conversation");
  const author = (await front.locator(".margin-welcome-author").boundingBox())!;
  const box = (await button.boundingBox())!;
  expect(Math.abs(box.y - author.y)).toBeLessThanOrEqual(8);
  const card = (await front.boundingBox())!;
  expect(card.x + card.width - box.x - box.width).toBeLessThanOrEqual(24);
  await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Close conversation" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  await captureScreenshot(front, {
    path: testInfo.outputPath("conversation-link.png"),
  });
});

test(
  "welcome refinements keep invitation copy, compact font punctuation and the differences strip",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.goto("/welcome");
    await page.evaluate(() => document.fonts.ready);
    await expect(
      page.getByRole("link", { name: "Membership by invitation", exact: true }),
    ).toHaveCount(2);
    await expect(page.getByText("Newest first", { exact: true })).toBeVisible();
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
    for (const id of [
      "public-title",
      "welcome-connection-title",
      "welcome-gallery-title",
      "welcome-joining-title",
    ])
      await expect(page.locator(`#${id}`)).toHaveCSS(
        "color",
        "rgb(69, 77, 36)",
      );
    const strip = page.getByRole("list", { name: "What’s different" });
    await expect(strip.getByRole("listitem")).toHaveText([
      "No like counts in the feed",
      "No ads",
      "No algorithm",
      "Posts disappear after 30 days",
      "Up to three posts a day",
    ]);
    expect((await strip.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await page.locator(".margin-welcome-interlude").boundingBox())!.y +
        (await page.locator(".margin-welcome-interlude").boundingBox())!.height,
    );
    expect(
      (await page.locator(".margin-welcome-connection").boundingBox())!.y,
    ).toBeGreaterThanOrEqual(
      (await strip.boundingBox())!.y + (await strip.boundingBox())!.height,
    );
    const widths = await page
      .locator(".margin-welcome-caught-up")
      .evaluate((node) => {
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
  "stacked hero centres the visible text group with left-aligned copy",
  { tag: "@extended" },
  async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome");
    for (const width of [390, 820, 1023]) {
      await page.setViewportSize({ width, height: 1000 });
      const opening = page.locator(".margin-welcome-opening");
      const hero = (await page.locator(".margin-public-hero").boundingBox())!;
      const group = (await opening.boundingBox())!;
      expect(
        Math.abs(group.x + group.width / 2 - (hero.x + hero.width / 2)),
      ).toBeLessThan(1);
      await expect(opening).toHaveCSS("text-align", "left");
      if (width === 820) {
        expect(group.width).toBeLessThan(600);
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
      await note.getByText("Still to be confirmed", { exact: true }).click();
      await expect(
        note.getByText(
          "Legal operator, address and dedicated privacy request process.",
        ),
      ).toBeVisible();
    }
  }
});

test("welcome keeps its editorial layout usable and its public examples keyboard accessible", async ({
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
    if (isMobile) {
      const photos = page.locator(".margin-welcome-gallery-photo");
      await expect(photos).toHaveCount(3);
      // Read every photo in the same layout frame. Separate boundingBox calls
      // can straddle a layout shift and report false differences after a resize.
      const tops = await photos.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().top),
      );
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    }
    if (width === 1440 || width === 390) {
      await captureScreenshot(page, {
        path: testInfo.outputPath(`welcome-${width}.png`),
        fullPage: true,
      });
    }
  }
  const conversation = page.getByRole("button", {
    name: "Open conversation",
    includeHidden: true,
  });
  await conversation.focus();
  await expect(conversation).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(conversation).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("This looks lovely. Where is it?")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close conversation" }),
  ).toBeFocused();
  await captureScreenshot(page, {
    path: testInfo.outputPath("welcome-conversation.png"),
  });
  await page.keyboard.press("Enter");
  await expect(conversation).toHaveAttribute("aria-expanded", "false");
  await expect(conversation).toBeFocused();

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
    "A little less.A little closer.",
  );
  const hero = page.locator(".margin-public-hero");
  const illustration = page.getByRole("figure", {
    name: "Feed and conversation",
  });
  await expect(
    hero.getByRole("link", { name: "See how it feels" }),
  ).toHaveAttribute("href", "#welcome-preview");
  await expect(illustration).toContainText("That’s everything for now.");
  const photo = illustration.getByRole("img");
  await expect(photo).toHaveAttribute("src", /coffee-shop/);
  await expect(photo).toHaveAttribute("loading", "eager");
  await expect(photo).toHaveJSProperty("complete", true);
  expect(
    await photo.evaluate((node: HTMLImageElement) => node.naturalWidth),
  ).toBeGreaterThan(0);
  const openingBounds = (await page
    .locator(".margin-welcome-opening")
    .boundingBox())!;
  const previewBounds = (await illustration.boundingBox())!;
  const messageBounds = (await page
    .getByRole("figure", { name: "Messages between friends" })
    .boundingBox())!;
  const heroBounds = (await hero.boundingBox())!;
  const viewport = await page.evaluate(() => ({
    left: document.body.getBoundingClientRect().left,
    width: document.body.getBoundingClientRect().width,
    gutter: parseFloat(
      getComputedStyle(document.querySelector(".margin-public-header")!)
        .paddingLeft,
    ),
  }));
  const contentWidth = Math.min(1600, viewport.width - 2 * viewport.gutter);
  expect(
    Math.abs(
      heroBounds.x - viewport.left - (viewport.width - contentWidth) / 2,
    ),
  ).toBeLessThan(1);
  expect(Math.abs(heroBounds.width - contentWidth)).toBeLessThan(1);
  if (page.viewportSize()!.width >= 1024) {
    expect(previewBounds.x).toBeGreaterThan(
      openingBounds.x + openingBounds.width,
    );
  } else {
    expect(previewBounds.y).toBeGreaterThan(
      openingBounds.y + openingBounds.height,
    );
  }
  expect(messageBounds.y).toBeGreaterThan(heroBounds.y + heroBounds.height);
  await expect(hero.getByRole("figure")).toHaveCount(1);
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
    "How margin works",
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
  ).toContainText("legal operator has not been confirmed");
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
  const caption = page.locator(".margin-welcome-message-afterword");
  await expect(caption).toHaveCSS("text-wrap", "balance");
  await captureScreenshot(page.locator(".margin-welcome-message-stage"), {
    path: info.outputPath("welcome-message-caption.png"),
  });
});

test("See how it feels shakes only the feed card and scrolls on mobile", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/welcome");
  const trigger = page.getByRole("link", {
    name: "See how it feels",
    exact: true,
  });
  const card = page.getByRole("figure", { name: "Feed and conversation" });
  await expect(trigger).toHaveAttribute("href", "#welcome-preview");
  await trigger.scrollIntoViewIfNeeded();
  const initialScroll = await page.evaluate(() => scrollY);
  await trigger.click();
  await expect
    .poll(() =>
      card.evaluate((node) =>
        node
          .getAnimations()
          .some(
            (animation) =>
              animation.id === "welcome-preview-shake" &&
              animation.playState === "running",
          ),
      ),
    )
    .toBe(true);
  if (isMobile) {
    await expect(card).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(initialScroll);
    await expect(page.locator("#welcome-preview")).toBeFocused();
  } else {
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
  }
  const conversation = page.getByRole("button", {
    name: "Open conversation",
    includeHidden: true,
  });
  await card.evaluate(async (node) => {
    const shake = node
      .getAnimations()
      .find((animation) => animation.id === "welcome-preview-shake");
    await shake?.finished;
  });
  expect(
    await conversation.evaluate((node) => node.getAnimations().length),
  ).toBe(0);
  expect(
    await card.evaluate((node) =>
      node
        .getAnimations()
        .some(
          (animation) =>
            animation.id === "welcome-preview-shake" &&
            animation.playState === "running",
        ),
    ),
  ).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("link", { name: "Flip the card", exact: true }).click();
  expect(
    await card.evaluate((node) =>
      node
        .getAnimations()
        .some((animation) => animation.id === "welcome-preview-shake"),
    ),
  ).toBe(false);
  expect(
    await conversation.evaluate((node) =>
      node
        .getAnimations()
        .some((animation) => animation.playState === "running"),
    ),
  ).toBe(false);
  if (isMobile) await expect(card).toBeInViewport();
});

test("hero demo link describes the next flip and shares state with Conversation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/welcome");
  await page
    .getByRole("link", { name: "See how it feels", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Flip the card", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open conversation", exact: true })
    .click();
  const reverse = page.getByRole("link", { name: "Turn it back", exact: true });
  await expect(reverse).toHaveCount(1);
  await reverse.click();
  await expect(page.locator(".margin-welcome-post-turn")).toHaveAttribute(
    "data-open",
    "false",
  );
  await page.getByRole("link", { name: "Flip the card", exact: true }).click();
  await expect(page.locator(".margin-welcome-post-turn")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Close conversation", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("link", { name: "Flip the card", exact: true }),
  ).toHaveCount(1);
});
