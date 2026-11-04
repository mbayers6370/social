import { captureScreenshot, expect, test } from "./fixtures";

declare global {
  interface Window {
    setTestVisualViewport: (height: number, top?: number) => void;
  }
}

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(
    !isMobile || process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Mobile development interactions",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    let height = window.innerHeight;
    let top = 0;
    Object.defineProperties(viewport, {
      height: { get: () => height },
      offsetTop: { get: () => top },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.setTestVisualViewport = (nextHeight, nextTop = 0) => {
      height = nextHeight;
      top = nextTop;
      viewport.dispatchEvent(new Event("resize"));
    };
  });
});

test("keeps the message composer above a simulated keyboard and retains typing focus after sending", async ({
  page,
}) => {
  await page.goto("/?view=messages&thread=ines");
  const input = page.getByRole("textbox", { name: "Note to self" });
  await input.fill("Keep this thought");
  await page.evaluate(() => window.setTestVisualViewport(420, 24));
  await expect
    .poll(
      async () =>
        (await input.boundingBox())!.y + (await input.boundingBox())!.height,
    )
    .toBeLessThanOrEqual(444);
  await expect(page.locator(".margin-thread-header")).toBeInViewport();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");
  await expect(
    page.getByRole("list", { name: "Notebook entries" }),
  ).toContainText("Keep this thought");
  await page.evaluate(() => window.setTestVisualViewport(innerHeight));
  await expect
    .poll(
      async () => (await page.locator(".margin-thread").boundingBox())!.height,
    )
    .toBe(await page.evaluate(() => innerHeight));
});

test("keeps the conversation and post composer actions above a simulated keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#post-book")
    .getByRole("button", { name: /Conversation on/ })
    .click();
  const input = page.getByRole("textbox", {
    name: "Add a comment",
    exact: true,
  });
  await input.fill("A little thought");
  await page.evaluate(() => window.setTestVisualViewport(430, 12));
  const post = page
    .locator(".margin-conversation-composer")
    .getByRole("button", { name: "Post", exact: true });
  await expect
    .poll(async () => {
      const bounds = (await post.boundingBox())!;
      return bounds.y + bounds.height;
    })
    .toBeLessThanOrEqual(442);
  await page.getByRole("button", { name: "Back to post", exact: true }).click();
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  const publish = page
    .locator(".margin-compose-dialog")
    .getByRole("button", { name: "Publish", exact: true });
  await expect
    .poll(async () => {
      const bounds = (await publish.boundingBox())!;
      return bounds.y + bounds.height;
    })
    .toBeLessThanOrEqual(442);
});

test("keeps photo selection actions reachable and enlarges the narrow gallery grid", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?view=gallery");
  await page.getByRole("button", { name: "Add photo", exact: true }).click();
  await page.evaluate(() => window.setTestVisualViewport(440, 10));
  const picker = page.getByRole("dialog", { name: "Choose a photograph" });
  const use = picker.getByRole("button", {
    name: "Use photograph",
    exact: true,
  });
  await expect
    .poll(async () => {
      const bounds = (await use.boundingBox())!;
      return bounds.y + bounds.height;
    })
    .toBeLessThanOrEqual(450);
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.evaluate(() => window.setTestVisualViewport(innerHeight));
  await page
    .getByRole("button", { name: "Arrange gallery", exact: true })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Arrange Gallery",
    exact: true,
  });
  const columns = await editor
    .locator(".margin-editor-grid")
    .evaluate(
      (node) => getComputedStyle(node).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(3);
  await expect(
    editor.getByRole("button", { name: "Done", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await captureScreenshot(page, {
    caret: "initial",
    path: testInfo.outputPath("mobile-gallery-arrange.png"),
  });
});

test("returning to messages does not add another thread to browser history", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open notebook", exact: true })
    .click();
  await expect(page).toHaveURL(/thread=ines/);
  await page
    .getByRole("button", { name: "Back to messages", exact: true })
    .click();
  await expect(page).toHaveURL(/\?view=messages$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/thread=/);
});

test("swipes between full photographs without treating vertical drags as navigation", async ({
  page,
}) => {
  await page.goto("/?view=gallery");
  await page.getByRole("button", { name: /View .*photograph 1 of/ }).click();
  const dialog = page.getByRole("dialog", { name: "Photograph", exact: true });
  const image = dialog.locator("figure img");
  const first = await image.getAttribute("alt");
  async function swipe(endX: number, endY: number) {
    await image.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: 200,
      clientY: 200,
    });
    await image.dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 1,
      isPrimary: true,
      clientX: endX,
      clientY: endY,
    });
  }
  await swipe(190, 290);
  await expect(image).toHaveAttribute("alt", first!);
  await swipe(100, 200);
  await expect(dialog.getByText("2 of 5", { exact: true })).toBeVisible();
  await expect(image).not.toHaveAttribute("alt", first!);
  await swipe(300, 200);
  await expect(dialog.getByText("1 of 5", { exact: true })).toBeVisible();
  await expect(image).toHaveAttribute("alt", first!);
});
