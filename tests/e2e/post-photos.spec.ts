import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development feed fixtures",
  );
  await page.goto("/?view=profile");
});

test("shows Ines's three photos before text, supports mobile swiping, and returns from the viewer", async ({
  page,
  isMobile,
}, testInfo) => {
  const post = page.locator("#post-fog");
  const strip = post.getByRole("group", {
    name: "Photographs from Ines Alvarez’s post",
  });
  const photos = strip.getByRole("button", { name: /^View photograph/ });
  await expect(photos).toHaveCount(3);
  await strip.scrollIntoViewIfNeeded();
  const mediaBounds = (await strip.boundingBox())!;
  const proseBounds = (await post.locator(".margin-post-prose").boundingBox())!;
  expect(mediaBounds.y + mediaBounds.height).toBeLessThan(proseBounds.y);
  if (isMobile) {
    await expect(strip).toHaveCSS("scrollbar-width", "none");
    expect(
      await strip.evaluate((node) => getComputedStyle(node).maskImage),
    ).not.toBe("none");
    const client = await page.context().newCDPSession(page);
    const start = mediaBounds.x + mediaBounds.width * 0.85;
    const y = mediaBounds.y + 50;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start, y }],
    });
    for (let step = 1; step <= 5; step++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start - step * mediaBounds.width * 0.13, y }],
      });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => strip.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("three-photo-post.png"),
  });
  const trigger = photos.nth(1);
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Photographs from Ines Alvarez’s post",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("2 of 3", { exact: true })).toBeVisible();
  await expect(dialog.locator("img")).toHaveAttribute(
    "alt",
    /quiet sandy beach/,
  );
  await dialog.getByRole("button", { name: "Next photograph" }).click();
  await expect(dialog.getByText("3 of 3", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByText("2 of 3", { exact: true })).toBeVisible();
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("full-photo-viewer.png"),
  });
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("can view a photograph while keeping the desktop conversation open", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "The original post is beside the conversation on desktop",
  );
  await page.goto("/");
  const post = page.locator("#post-porch");
  await post.locator("[data-conversation-trigger]").click();
  await expect(post).toHaveAttribute("data-phase", "open");
  await post.getByRole("button", { name: /^View photograph 1/ }).click();
  const viewer = page.getByRole("dialog", {
    name: "Photographs from June Park’s post",
  });
  await expect(viewer).toBeVisible();
  await viewer
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(viewer).not.toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Conversation on June Park’s post" }),
  ).toBeVisible();
  await expect(post).toHaveAttribute("data-phase", "open");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("publishes three photographs together and preserves the image limit across the next post", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  const compose = page.getByRole("dialog", { name: "New Post", exact: true });
  await compose
    .getByRole("textbox", { name: "Your post" })
    .fill("Three little moments from today.");
  for (let index = 0; index < 3; index++) {
    await compose.getByRole("button", { name: "Add photograph" }).click();
    const picker = page.getByRole("dialog", { name: "Choose a photograph" });
    await picker.getByRole("button", { name: /^Use / }).nth(index).click();
  }
  await expect(
    compose.getByRole("button", { name: "Add photograph" }),
  ).toBeDisabled();
  await compose.getByRole("button", { name: "Share with friends" }).click();
  await expect(compose).not.toBeVisible();
  await expect(page).toHaveURL(/\?view=profile#post-local-/);
  const publishedPost = page.locator(`#${new URL(page.url()).hash.slice(1)}`);
  await expect(
    publishedPost.getByRole("button", { name: /^View photograph/ }),
  ).toHaveCount(3);
  await page.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Feed", exact: true }),
  ).toBeAttached();
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  await expect(
    compose.getByRole("button", { name: "Add photograph" }),
  ).toBeDisabled();
  await expect(compose.locator("#photo-allowance")).toContainText(
    "0 photographs remaining today",
  );
  await compose
    .getByRole("textbox", { name: "Your post" })
    .fill("A text-only thought can still be shared.");
  await expect(
    compose.getByRole("button", { name: "Share with friends" }),
  ).toBeEnabled();
});
