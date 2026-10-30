import { expect, test, type Page } from "./fixtures";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development fixtures are excluded from production",
  );
  await page.goto("/");
  if (testInfo.project.name === "chromium-scrollbars") {
    // Exercise classic, permanently reserved scrollbars even on overlay-scrollbar hosts.
    await page.addStyleTag({
      content:
        "html { overflow-y: scroll; } html::-webkit-scrollbar { width: 15px; height: 15px; }",
    });
    await expect
      .poll(() =>
        page.evaluate(() => innerWidth - document.documentElement.clientWidth),
      )
      .toBe(15);
  }
});

async function openPost(page: Page, id = "post-fog") {
  if (!(await page.locator(`#${id}`).count()))
    await page.goto(
      id === "post-fog" || id.startsWith("post-local-")
        ? "/?view=profile"
        : "/",
    );
  const trigger = page.locator(`#${id} [data-conversation-trigger]`);
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator(`#${id}`)).toHaveAttribute("data-phase", "open");
  return dialog;
}

test("shows the reference feed in chronological order with mobile-first navigation", async ({
  page,
}, testInfo) => {
  expect(
    await page
      .locator(".margin-feed-post")
      .evaluateAll((posts) => posts.map((post) => post.id)),
  ).toEqual([
    "post-book",
    "post-porch",
    "post-notebook",
    "post-tea",
    "post-june-birthday",
    "post-samuel-beach",
    "post-june-lunch",
    "post-samuel-lunch",
    "post-samuel-bookshelf",
    "post-theo-rome",
    "post-theo-football",
    "post-mara-river",
    "post-mara-street",
  ]);
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toHaveCount(0);
  const referenceTime = await page
    .locator(".margin-date time")
    .getAttribute("datetime");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(referenceTime!));
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400_000)
    .toISOString()
    .slice(0, 10);
  const heading = page
    .locator(".margin-day-heading")
    .filter({ has: page.locator('time[datetime="2026-10-27"]') });
  if (today === "2026-10-27") await expect(heading).toHaveCount(0);
  else {
    await expect(heading).toHaveText(
      yesterday === "2026-10-27" ? "Yesterday" : "Tuesday, 27 October",
    );
    await expect(heading).toHaveCSS("font-weight", "500");
  }
  expect(
    await page
      .locator("#post-porch")
      .evaluate((node) => getComputedStyle(node).borderBottomWidth),
  ).toBe("1px");
  await expect(page.locator(".margin-feed-list figcaption")).toHaveCount(0);
  await expect(page.locator("#post-fog")).toHaveCount(0);
  await expect(page.locator("#post-porch .margin-post-image")).toHaveAttribute(
    "loading",
    "eager",
  );
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  await expect(
    page.getByRole("navigation", {
      name: mobile ? "Mobile navigation" : "Primary",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("margin-feed.png"),
    fullPage: true,
  });
});

test("opens the correct conversation, keeps Like at the top, and restores scroll and focus", async ({
  page,
}, testInfo) => {
  const post = page.locator("#post-porch");
  const trigger = post.locator("[data-conversation-trigger]");
  await trigger.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    y: scrollY,
    post: document
      .getElementById("post-porch")!
      .getBoundingClientRect()
      .toJSON(),
    next: document
      .getElementById("post-notebook")!
      .getBoundingClientRect()
      .toJSON(),
  }));
  const dialog = await openPost(page, "post-porch");
  await expect(dialog).toHaveAccessibleName("Conversation on June Park’s post");
  await expect(
    dialog.getByRole("button", { name: "Like", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.locator(".margin-conversation-header")).not.toContainText(
    "12",
  );
  await expect(dialog.locator("[data-like-count]")).toHaveText("12 likes");
  await expect(dialog.locator("[data-like-count]")).toHaveCount(1);
  await expect(
    dialog.getByRole("button", {
      name:
        (page.viewportSize()?.width ?? 0) >= 1024
          ? "Back to post"
          : "Close conversation",
      exact: true,
    }),
  ).toHaveCount(0);
  const after = await page.locator("#post-notebook").boundingBox();
  const scrollDelta = (await page.evaluate(() => scrollY)) - before.y;
  const growth =
    (await post.locator("..").boundingBox())!.height - before.post.height;
  expect(after?.x).toBeCloseTo(before.next.x, 1);
  expect(after?.y).toBeCloseTo(before.next.y + growth - scrollDelta, 1);
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const moved = await post.boundingBox();
    const panel = await dialog.boundingBox();
    expect(moved!.x).toBeLessThan(before.post.x - 100);
    expect(moved!.y).toBeCloseTo(before.post.y - scrollDelta, 1);
    expect(panel!.height).toBeCloseTo(moved!.height, 1);
    expect(panel!.y).toBeCloseTo(moved!.y, 1);
    const content = (await page.locator(".margin-main").boundingBox())!;
    expect((moved!.x + panel!.x + panel!.width) / 2).toBeCloseTo(
      content.x + content.width / 2,
      0,
    );
  } else {
    const panel = await dialog.boundingBox();
    expect(panel!.x).toBeCloseTo(0, 0);
    expect(panel!.y).toBeCloseTo(0, 0);
    expect(panel!.height).toBeCloseTo(page.viewportSize()!.height, 0);
  }
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("margin-conversation.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before.y, 0);
});

test("paginates, likes, replies and adds escaped local comments without sending requests", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      !request.url().includes("_next")
    )
      mutations.push(request.url());
  });
  const dialog = await openPost(page);
  await expect(
    dialog.getByRole("list", { name: "Comments" }).locator(":scope > li"),
  ).toHaveCount(5);
  await dialog.getByRole("button", { name: "Like", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Liked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator("[data-like-count]")).toHaveText("49 likes");
  await dialog.getByRole("button", { name: "Load more comments" }).click();
  await expect(
    dialog.getByRole("list", { name: "Comments" }).locator(":scope > li"),
  ).toHaveCount(8);
  await dialog
    .getByRole("button", { name: "Reply to Theo Marchetti" })
    .first()
    .click();
  const input = dialog.getByRole("textbox", {
    name: "Reply to Theo Marchetti",
  });
  await expect(input).toBeFocused();
  await input.fill("<script>window.compromised=true</script> A local thought.");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("isn’t saved");
  await expect(
    dialog.getByRole("list", { name: "Comments" }).locator(":scope > li"),
  ).toHaveCount(8);
  await expect(
    dialog.getByText(
      "<script>window.compromised=true</script> A local thought.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await page.evaluate(() => "compromised" in window)).toBe(false);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const reopened = await openPost(page);
  await expect(reopened.locator("[data-like-count]")).toHaveText("49 likes");
  await expect(
    reopened.getByRole("list", { name: "Comments" }).locator(":scope > li"),
  ).toHaveCount(8);
  expect(mutations).toEqual([]);
});

test("handles an empty conversation, validates input, and preserves independent drafts", async ({
  page,
}) => {
  const dialog = await openPost(page, "post-book");
  await expect(
    dialog.getByText("No comments yet. Be the first to leave a thought."),
  ).toBeVisible();
  await dialog.getByRole("textbox", { name: "Add a comment" }).focus();
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Write a thought before posting.",
  );
  const input = dialog.getByRole("textbox", { name: "Add a comment" });
  await expect(input).toBeFocused();
  await input.fill("An unfinished thought");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const other = await openPost(page, "post-porch");
  await expect(
    other.getByRole("textbox", { name: "Add a comment" }),
  ).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(other).not.toBeVisible();
  const returned = await openPost(page, "post-book");
  await expect(
    returned.getByRole("textbox", { name: "Add a comment" }),
  ).toHaveValue("An unfinished thought");
  await returned.getByRole("textbox", { name: "Add a comment" }).focus();
  await returned.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    returned.getByRole("list", { name: "Comments" }).locator(":scope > li"),
  ).toHaveCount(1);
});

test("supports keyboard entry, focus containment and browser Back", async ({
  page,
}) => {
  const trigger = page.locator("#post-book [data-conversation-trigger]");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(page.locator("#post-book")).toHaveAttribute(
    "data-phase",
    "open",
  );
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("provides a reduced-motion crossfade and visible reversible controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dialog = await openPost(page, "post-book");
  const animations = await dialog.evaluate((node) =>
    node.getAnimations().map((animation) => ({
      duration: animation.effect!.getTiming().duration,
      frames: (animation.effect as KeyframeEffect)
        .getKeyframes()
        .map((frame) => frame.transform),
    })),
  );
  expect(
    animations.every((animation) => Number(animation.duration) <= 120),
  ).toBe(true);
  expect(
    animations.every((animation) =>
      animation.frames.every((transform) => !transform || transform === "none"),
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", {
      name:
        (page.viewportSize()?.width ?? 0) < 1024
          ? "Back to post"
          : "Close conversation",
      exact: true,
    })
    .click();
  await expect(dialog).not.toBeVisible();
});

test("keeps the active experience usable when switching between desktop and mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const dialog = await openPost(page, "post-porch");
  await dialog.getByRole("button", { name: "Like", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    dialog.getByRole("button", { name: "Back to post", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Liked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')!;
        return Math.abs(
          dialog.getBoundingClientRect().width -
            (window.visualViewport?.width ?? window.innerWidth),
        );
      }),
    )
    .toBeLessThan(1);
  await page.setViewportSize({ width: 1280, height: 700 });
  await expect(dialog).toHaveAttribute("data-layout", "panel");
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await expect
    .poll(async () => {
      const panel = await dialog.boundingBox();
      const post = await page.locator("#post-porch").boundingBox();
      return Math.abs(panel!.height - post!.height);
    })
    .toBeLessThan(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
});

test("desktop pairs expand in the feed without overlapping adjacent posts and retain an inset composer", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Desktop panels; mobile conversations remain full screen",
  );
  await page.setViewportSize({ width: 1280, height: 1400 });
  for (const id of ["post-book", "post-porch", "post-notebook", "post-tea"]) {
    const post = page.locator(`#${id}`);
    await post.scrollIntoViewIfNeeded();
    const original = (await post.boundingBox())!;
    const originalScroll = await page.evaluate(() => scrollY);
    const neighbors = await page
      .locator(".margin-feed-post")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          id: node.id,
          x: node.getBoundingClientRect().x,
          y: node.getBoundingClientRect().y + scrollY,
        })),
      );
    const proseHeight = (await post
      .locator(".margin-post-prose")
      .boundingBox())!.height;
    const dialog = await openPost(page, id);
    const panelBounds = (await dialog.boundingBox())!;
    const postBounds = (await post.boundingBox())!;
    expect(panelBounds.height).toBeCloseTo(postBounds.height, 1);
    expect(postBounds.height).toBeGreaterThanOrEqual(
      Math.max(original.height, 640) - 1,
    );
    expect(
      (await post.locator(".margin-post-prose").boundingBox())!.height,
    ).toBeCloseTo(proseHeight, 1);
    const activeIndex = neighbors.findIndex((neighbor) => neighbor.id === id);
    const currentScroll = await page.evaluate(() => scrollY);
    const growth =
      (await post.locator("..").boundingBox())!.height - original.height;
    for (const [index, neighbor] of neighbors.entries()) {
      if (neighbor.id === id) continue;
      const bounds = (await page.locator(`#${neighbor.id}`).boundingBox())!;
      expect(bounds.x).toBeCloseTo(neighbor.x, 1);
      expect(
        Math.abs(
          bounds.y +
            currentScroll -
            neighbor.y -
            (index > activeIndex ? growth : 0),
        ),
      ).toBeLessThan(1);
    }
    if (neighbors[activeIndex + 1]) {
      const next = (await page
        .locator(`#${neighbors[activeIndex + 1].id}`)
        .boundingBox())!;
      expect(next.y).toBeGreaterThanOrEqual(
        Math.max(
          postBounds.y + postBounds.height,
          panelBounds.y + panelBounds.height,
        ) - 1,
      );
    }
    if (neighbors[activeIndex - 1]) {
      const previous = (await page
        .locator(`#${neighbors[activeIndex - 1].id}`)
        .boundingBox())!;
      expect(previous.y + previous.height).toBeLessThanOrEqual(
        Math.min(postBounds.y, panelBounds.y) + 1,
      );
    }
    expect(
      Math.abs(
        panelBounds.y +
          panelBounds.height / 2 -
          (postBounds.y + postBounds.height / 2),
      ),
    ).toBeLessThan(1);
    await expect(dialog.getByRole("textbox")).toBeInViewport();
    await dialog.getByRole("textbox").focus();
    const inputBox = (await dialog
      .locator(".margin-comment-input")
      .boundingBox())!;
    const footerBox = (await dialog
      .locator(".margin-conversation-footer")
      .boundingBox())!;
    expect(inputBox.x).toBeCloseTo(footerBox.x, 1);
    expect(inputBox.width).toBeCloseTo(footerBox.width, 1);
    expect(inputBox.x - panelBounds.x).toBeGreaterThanOrEqual(24);
    expect(
      panelBounds.x + panelBounds.width - inputBox.x - inputBox.width,
    ).toBeGreaterThanOrEqual(24);
    const textBounds = (await dialog.getByRole("textbox").boundingBox())!;
    const buttonBounds = (await dialog
      .getByRole("button", { name: "Post", exact: true })
      .boundingBox())!;
    expect(buttonBounds.y).toBeGreaterThan(textBounds.y + textBounds.height);
    if (id === "post-porch" || id === "post-book")
      await page.screenshot({
        caret: "initial",
        path: testInfo.outputPath(`conversation-${id}.png`),
      });
    await dialog
      .getByRole("button", { name: "Close conversation", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(post.locator("[data-conversation-trigger]")).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(originalScroll, 1);
    for (const neighbor of neighbors) {
      const documentTop = await page
        .locator(`#${neighbor.id}`)
        .evaluate((node) => node.getBoundingClientRect().top + scrollY);
      expect(Math.abs(documentTop - neighbor.y)).toBeLessThan(1);
    }
  }
  await page.setViewportSize({ width: 1280, height: 500 });
  const dialog = await openPost(page, "post-porch");
  const headerHeight = (await page.locator(".margin-header").boundingBox())!
    .height;
  const postHeight = (await page.locator("#post-porch").boundingBox())!.height;
  expect((await dialog.boundingBox())!.height).toBeCloseTo(postHeight, 1);
  expect(postHeight).toBeGreaterThanOrEqual(500 - headerHeight - 64);
  await expect(
    dialog.getByRole("button", { name: "Close conversation", exact: true }),
  ).toBeInViewport();
  const input = dialog.getByRole("textbox", { name: "Add a comment" });
  const inputWidth = (await dialog
    .locator(".margin-conversation-footer")
    .boundingBox())!.width;
  await dialog
    .locator(".margin-conversation-composer")
    .scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport();
  expect((await input.boundingBox())!.height).toBe(44);
  // Make overflow deliberate rather than depending on a fixture's comment count.
  await input.fill(
    "A longer thought to exercise scrolling in a short window. ".repeat(25),
  );
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  const scroll = dialog.getByRole("region", { name: "Conversation content" });
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  await expect(dialog).toHaveAttribute("data-more-below", "true");
  const composerBounds = (await dialog
    .locator(".margin-conversation-composer")
    .boundingBox())!;
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(dialog).toHaveAttribute("data-more-below", "false");
  expect(
    (await dialog.locator(".margin-conversation-composer").boundingBox())!.y,
  ).toBeCloseTo(composerBounds.y, 1);
  await expect(dialog.locator("[data-like-count]")).toBeInViewport();
  await input.fill("The composer is still reachable in a short window.");
  expect((await input.boundingBox())!.height).toBeGreaterThan(44);
  expect(
    (await dialog.locator(".margin-comment-input").boundingBox())!.width,
  ).toBeCloseTo(inputWidth, 1);
  await expect(input).toBeInViewport();
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("isn’t saved");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("opens the local post composer and returns to the feed", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "New Post", exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Your post" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("comment field expands in place on focus, preserves drafts, and collapses only when empty", async ({
  page,
}) => {
  const dialog = await openPost(page, "post-book");
  const input = dialog.getByRole("textbox", { name: "Add a comment" });
  const form = dialog.locator(".margin-comment-form");
  const postButton = dialog.getByRole("button", { name: "Post", exact: true });
  await expect(form).toHaveAttribute("data-expanded", "false");
  await expect(postButton).toHaveCount(0);
  const width = (await dialog
    .locator(".margin-conversation-footer")
    .boundingBox())!.width;
  const collapsed = (await dialog
    .locator(".margin-comment-input")
    .boundingBox())!;
  const metadata = (await dialog
    .locator(".margin-conversation-footer")
    .boundingBox())!;
  expect(collapsed.width).toBeCloseTo(width, 1);
  expect(metadata.y - collapsed.y - collapsed.height).toBeGreaterThanOrEqual(
    24,
  );
  await input.focus();
  await expect(form).toHaveAttribute("data-expanded", "true");
  await expect(postButton).toBeVisible();
  expect((await input.boundingBox())!.height).toBeGreaterThan(44);
  expect(
    (await dialog.locator(".margin-comment-input").boundingBox())!.width,
  ).toBeCloseTo(width, 1);
  const expanded = (await dialog
    .locator(".margin-comment-input")
    .boundingBox())!;
  expect(expanded.y).toBeLessThan(collapsed.y);
  expect(expanded.y + expanded.height).toBeCloseTo(
    collapsed.y + collapsed.height,
    1,
  );
  expect(
    (await dialog.locator(".margin-conversation-footer").boundingBox())!.y,
  ).toBeCloseTo(metadata.y, 1);
  await dialog.getByRole("button", { name: "Like", exact: true }).focus();
  await expect(form).toHaveAttribute("data-expanded", "false");
  await input.fill("An unfinished thought");
  await dialog.getByRole("button", { name: "Like", exact: true }).focus();
  await expect(form).toHaveAttribute("data-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  const reopened = await openPost(page, "post-book");
  const restored = reopened.getByRole("textbox", { name: "Add a comment" });
  await expect(restored).toHaveValue("An unfinished thought");
  await expect(reopened.locator(".margin-comment-form")).toHaveAttribute(
    "data-expanded",
    "false",
  );
  expect((await restored.boundingBox())!.height).toBe(44);
  await expect(
    reopened.getByRole("button", { name: "Post", exact: true }),
  ).toHaveCount(0);
  await restored.focus();
  await expect(reopened.locator(".margin-comment-form")).toHaveAttribute(
    "data-expanded",
    "true",
  );
  await restored.fill("");
  await reopened.getByRole("button", { name: "Like", exact: true }).focus();
  await expect(reopened.locator(".margin-comment-form")).toHaveAttribute(
    "data-expanded",
    "false",
  );
});

test("conversation controls have padded hover targets and a soft comment focus border", async ({
  page,
  isMobile,
}, testInfo) => {
  const dialog = await openPost(page, "post-porch");
  const like = dialog.getByRole("button", { name: "Like", exact: true });
  await expect(like).toBeVisible();
  const padding = await like.evaluate((node) => {
    const style = getComputedStyle(node);
    return [parseFloat(style.paddingLeft), parseFloat(style.paddingRight)];
  });
  expect(Math.min(...padding)).toBeGreaterThanOrEqual(10);
  await like.hover();
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("like-hover.png"),
  });
  if (!isMobile) {
    const close = dialog.getByRole("button", {
      name: "Close conversation",
      exact: true,
    });
    const button = (await close.boundingBox())!;
    const icon = (await close.locator("svg").boundingBox())!;
    expect(icon.x - button.x).toBeGreaterThanOrEqual(8);
    expect(
      button.x + button.width - icon.x - icon.width,
    ).toBeGreaterThanOrEqual(8);
    expect(icon.y - button.y).toBeGreaterThanOrEqual(8);
    await expect(close).toHaveCSS("border-left-width", "0px");
    await expect(dialog.locator(".margin-conversation-close-slot")).toHaveCSS(
      "border-left-width",
      "0px",
    );
    await close.hover();
    await page.screenshot({
      caret: "initial",
      path: testInfo.outputPath("close-hover.png"),
    });
  } else {
    const back = dialog.getByRole("button", { name: "Back to post" });
    await expect(back).toHaveCSS("font-size", "13px");
    await expect(back.locator(".lucide-chevron-left")).toHaveCount(1);
  }
  const input = dialog.getByRole("textbox", { name: "Add a comment" });
  expect((await input.boundingBox())!.height).toBe(44);
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("inline-comment.png"),
  });
  await input.focus();
  const focus = await dialog
    .locator(".margin-comment-input")
    .evaluate((node) => {
      const style = getComputedStyle(node);
      const field = getComputedStyle(node.querySelector("textarea")!);
      return {
        border: style.borderColor,
        shadow: style.boxShadow,
        text: field.color,
        outline: field.outlineStyle,
      };
    });
  expect(focus.border).not.toBe(focus.text);
  expect(focus.shadow).not.toBe("none");
  expect(focus.outline).toBe("none");
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("expanded-comment-focus.png"),
  });
});

test("keeps the comment composer pinned with likes and expiry directly underneath", async ({
  page,
  isMobile,
}, testInfo) => {
  const initialViewport = isMobile
    ? { width: 390, height: 700 }
    : { width: 1280, height: 900 };
  await page.setViewportSize(initialViewport);
  const dialog = await openPost(page);
  const composer = dialog.locator(".margin-conversation-composer");
  const form = composer.locator("form");
  const meta = composer.locator(".margin-conversation-footer");
  const scroll = dialog.getByRole("region", { name: "Conversation content" });
  const input = composer.getByRole("textbox", { name: "Add a comment" });
  await expect(input).toBeInViewport();
  await expect(meta.locator("[data-like-count]")).toHaveText("48 likes");
  await expect(meta.getByText(/Disappears/)).toBeInViewport();
  expect((await meta.boundingBox())!.y).toBeGreaterThan(
    (await form.boundingBox())!.y + (await form.boundingBox())!.height,
  );
  const original = (await composer.boundingBox())!;
  await scroll.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect(await scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect((await composer.boundingBox())!.y).toBeCloseTo(original.y, 1);
  await scroll.evaluate((node) => {
    node.scrollTop = 0;
  });
  expect((await composer.boundingBox())!.y).toBeCloseTo(original.y, 1);
  await dialog.getByRole("button", { name: "Like", exact: true }).click();
  await expect(meta.locator("[data-like-count]")).toHaveText("49 likes");
  await input.fill("A thought from the pinned composer.");
  await composer.getByRole("button", { name: "Post", exact: true }).click();
  await expect(composer.getByRole("status")).toContainText("isn’t saved");
  await expect(meta.getByText(/Disappears/)).toBeInViewport();
  for (const viewport of isMobile
    ? [
        { width: 320, height: 568 },
        { width: 390, height: 460 },
      ]
    : [{ width: 1280, height: 500 }]) {
    await page.setViewportSize(viewport);
    if (!isMobile) await composer.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    await expect(meta).toBeInViewport();
    expect(
      (await meta.boundingBox())!.y + (await meta.boundingBox())!.height,
    ).toBeLessThanOrEqual(viewport.height);
    expect((await scroll.boundingBox())!.height).toBeGreaterThan(0);
  }
  await page.setViewportSize(initialViewport);
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("pinned-comment-footer.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator("#post-fog [data-conversation-trigger]"),
  ).toBeFocused();
});

test("keeps navigation and conversation controls usable from small phones to wide desktops", async ({
  page,
}) => {
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openPost(page, "post-book");
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await dialog.getByRole("button", { name: "Like", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Liked", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("button", { name: "Liked", exact: true }).click();
    await dialog
      .getByRole("button", {
        name: width < 1024 ? "Back to post" : "Close conversation",
        exact: true,
      })
      .click();
    await expect(dialog).not.toBeVisible();
  }
});

test("reverses the opening animation when closing", async ({ page }) => {
  const dialog = await openPost(page, "post-book");
  const frames = await dialog.evaluate(async (node) => {
    const motion = node.getAnimations()[0];
    // openPost waits for the entrance to finish. Seek back into that entrance
    // so this actually tests reversing an in-progress animation.
    motion.pause();
    await motion.ready;
    motion.currentTime = Number(motion.effect!.getTiming().duration) / 2;
    motion.playbackRate = 0.2;
    return (motion.effect as KeyframeEffect).getKeyframes();
  });
  if ((page.viewportSize()?.width ?? 0) < 1024)
    expect(
      frames.some((frame) => String(frame.transform).includes("-180deg")),
    ).toBe(true);
  else
    expect(
      frames.some((frame) => String(frame.clipPath).includes("100%")),
    ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#post-book")).toHaveAttribute(
    "data-phase",
    "closing",
  );
  expect(
    await dialog.evaluate(async (node) => {
      const motion = node.getAnimations()[0];
      await motion.ready;
      return motion.playbackRate;
    }),
  ).toBeLessThan(0);
  // The slow rate makes the reversal observable; finish at its normal speed.
  await dialog.evaluate((node) => {
    node.getAnimations()[0].playbackRate = -1;
  });
  await expect(dialog).not.toBeVisible();
});

test("supports optional touch swipes with the same reversible conversation", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile gesture enhancement");
  const post = page.locator("#post-book");
  await post.scrollIntoViewIfNeeded();
  const bounds = (await post.boundingBox())!;
  const client = await page.context().newCDPSession(page);
  async function swipe(x1: number, x2: number, y: number) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: x1, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x2, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  await swipe(
    bounds.x + bounds.width * 0.85,
    bounds.x + bounds.width * 0.15,
    bounds.y + 100,
  );
  const dialog = page.getByRole("dialog");
  await expect(post).toHaveAttribute("data-phase", "open");
  await expect(dialog).toBeVisible();
  await swipe(45, 345, 195);
  await expect(dialog).not.toBeVisible();
  await expect(post.locator("[data-conversation-trigger]")).toBeFocused();
  await client.detach();
});
