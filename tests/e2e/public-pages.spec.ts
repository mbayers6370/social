import { expect, test } from "./fixtures";

test("closing invitation leads with two readable lines and a joining link", async ({
  page,
}, testInfo) => {
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
    "Have someone in mind? Start with your invitation.",
    { exact: true },
  );
  expect((await note.boundingBox())!.y).toBeGreaterThan(
    (await heading.boundingBox())!.y,
  );
  await expect(section.getByRole("button")).toHaveCount(0);
  await section.screenshot({
    path: testInfo.outputPath("personal-invitation.png"),
  });
});

test("conversation invitation animates while visible and remains clear with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/welcome");
  const button = page.getByRole("button", {
    name: "Open conversation",
    includeHidden: true,
  });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toHaveAttribute("data-hint", "active");
  await expect(button.locator("svg")).toHaveCSS(
    "animation-play-state",
    "running",
  );
  await expect
    .poll(() =>
      button
        .locator("svg")
        .evaluate((icon) => getComputedStyle(icon).transform),
    )
    .not.toBe("none");
  await expect(button.getByText("Open", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("conversation-invitation.png"),
  });
  await button.click();
  await expect(button).not.toHaveAttribute("data-hint");
  await page.getByRole("button", { name: "Close conversation" }).click();
  await expect(button).not.toHaveAttribute("data-hint");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await button.scrollIntoViewIfNeeded();
  await expect(button.getByText("Open", { exact: true })).toBeVisible();
  await expect(button.locator("svg")).toHaveCSS("animation-name", "none");
});

test("stacked hero centres the visible text group with left-aligned copy", async ({
  page,
}, testInfo) => {
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
      await page.screenshot({ path: testInfo.outputPath("tablet-hero.png") });
    }
  }
});

test("public documents keep their content readable and their section links usable", async ({
  page,
}, testInfo) => {
  for (const route of ["why-margin", "help", "privacy"]) {
    await page.goto(`/${route}`);
    const article = page.locator(".margin-public-document");
    await expect(article.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${route}.png`) });
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
          "Legal operator, address, official domain and privacy contact.",
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
  for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (isMobile) {
      const photos = await page.locator(".margin-welcome-gallery-photo").all();
      const boxes = await Promise.all(
        photos.map((photo) => photo.boundingBox()),
      );
      for (const box of boxes)
        expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
    }
    if (width === 1440 || width === 390) {
      await page.screenshot({
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
  await page.screenshot({
    path: testInfo.outputPath("welcome-conversation.png"),
  });
  await page.keyboard.press("Enter");
  await expect(conversation).toHaveAttribute("aria-expanded", "false");
  await expect(conversation).toBeFocused();

  await page.evaluate(
    () => (document.documentElement.dataset.readingSize = "extra-large"),
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
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
    width: document.documentElement.clientWidth,
    gutter: parseFloat(
      getComputedStyle(document.querySelector(".margin-public-header")!)
        .paddingLeft,
    ),
  }));
  const contentWidth = Math.min(1600, viewport.width - 2 * viewport.gutter);
  expect(
    Math.abs(heroBounds.x - (viewport.width - contentWidth) / 2),
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
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Join Margin", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A place for your people.",
  );
  await expect(page.getByLabel("Your invitation code")).toBeVisible();
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
  ).toContainText("support@example.com");
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
