import { expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixtures"),
);

test("feed writing is full width and three lines with the avatar beside posting status", async ({
  page,
  isMobile,
}, info) => {
  await memberFixture(page);
  await page.route("**/__member_fixture/api/posts/allowance", (route) =>
    route.fulfill({ json: { regularRemaining: 2, linkAllowed: false } }),
  );
  await page.goto("/preview/auth?view=member");
  await page
    .getByRole("button", { name: "Share a thought…", exact: true })
    .click();
  const writing = page.locator(".margin-compose-writing");
  const input = page.getByRole("textbox", { name: "Your post", exact: true });
  await expect(input).toHaveAttribute("rows", "3");
  await expect(writing.locator(".margin-avatar")).toHaveCount(0);
  expect((await input.boundingBox())!.width).toBeCloseTo(
    (await writing.boundingBox())!.width,
    1,
  );
  const dimensions = await input.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      height:
        node.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom),
      lineHeight: parseFloat(style.lineHeight),
    };
  });
  expect(
    Math.abs(dimensions.height - dimensions.lineHeight * 3),
  ).toBeLessThanOrEqual(1);
  if (isMobile)
    await expect(
      page.locator(
        ".margin-compose-header .margin-compose-author .margin-avatar",
      ),
    ).toBeVisible();
  else {
    await expect(
      page.locator(".margin-compose-posting-status .margin-avatar"),
    ).toBeVisible();
    await expect(page.locator(".margin-compose-posting-status")).toContainText(
      "You’ve posted today",
    );
  }
  await page.screenshot({ path: info.outputPath("feed-composer.png") });
});

test("profile thumbnails open independently and only openable images use the branded cursor", async ({
  page,
}, info) => {
  await page.goto("/?view=profile");
  const thumbnails = page.locator(".margin-gallery-preview button");
  await expect(thumbnails).toHaveCount(3);
  await expect(page.locator(".margin-photo-open-mark")).toHaveCount(0);
  const cursor = await thumbnails
    .first()
    .locator("img")
    .evaluate((node) => getComputedStyle(node).cursor);
  expect(cursor).toContain("/brands/photo-open-cursor.svg");
  const more = page
    .locator(".margin-profile-gallery")
    .getByRole("link", { name: "View More" });
  expect(
    await more.evaluate((node) => getComputedStyle(node).cursor),
  ).not.toContain("photo-open-cursor");
  expect(
    (await page.request.get("/brands/photo-open-cursor.svg")).status(),
  ).toBe(200);
  for (let index = 0; index < 3; index++) {
    await thumbnails.nth(index).click();
    const viewer = page.getByRole("dialog", { name: "Gallery photographs" });
    await expect(viewer).toBeVisible();
    await expect(
      viewer.getByText(`${index + 1} of 3`, { exact: true }),
    ).toBeVisible();
    await viewer
      .getByRole("button", { name: "Back to gallery", exact: true })
      .click();
    await expect(viewer).toHaveCount(0);
    await expect(thumbnails.nth(index)).toBeFocused();
  }
  await page.screenshot({ path: info.outputPath("profile-thumbnails.png") });
  await more.click();
  await expect(page).toHaveURL(/view=gallery/);
});

test("Arrange Gallery groups selected-photo tools and separates save actions", async ({
  page,
  isMobile,
}, info) => {
  await page.goto("/?view=gallery");
  await page.getByRole("button", { name: "Arrange gallery" }).click();
  const editor = page.getByRole("dialog", { name: "Arrange Gallery" });
  await editor
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await expect(
    editor.locator(".margin-editor-selected-photo img"),
  ).toBeVisible();
  const actions = editor.locator(".margin-editor-selection-actions button");
  await expect(actions).toHaveCount(4);
  const boxes = await actions.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { width: box.width, y: box.y, bottom: box.bottom };
    }),
  );
  for (const box of boxes) expect(box.width).toBeCloseTo(boxes[0].width, 0);
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(
    isMobile ? 2 : 1,
  );
  const done = editor.getByRole("button", { name: "Done", exact: true });
  expect((await done.boundingBox())!.y).toBeGreaterThan(
    Math.max(...boxes.map((box) => box.bottom)),
  );
  await page.screenshot({ path: info.outputPath("arrange-gallery.png") });
});

test("post deletion offers photo removal as an unchecked opt-in", async ({
  page,
}, info) => {
  await memberFixture(page);
  const choices: unknown[] = [];
  await page.route("**/__member_fixture/api/posts/fictional-post", (route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    choices.push(
      route.request().postData() ? route.request().postDataJSON() : undefined,
    );
    return route.fulfill({ json: {} });
  });
  for (const removePhotos of [false, true]) {
    await page.goto("/preview/auth?view=member&area=profile");
    await page
      .locator("article")
      .getByRole("button", { name: "Edit", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Edit post" })
      .getByRole("button", { name: "Delete post", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog", { name: "Delete this post?" });
    const option = dialog.getByRole("checkbox", {
      name: "Also delete attached photographs",
    });
    await expect(option).not.toBeChecked();
    if (removePhotos) await option.check();
    if (removePhotos)
      await page.screenshot({
        path: info.outputPath("delete-post-photos.png"),
      });
    await dialog
      .getByRole("button", { name: "Delete post", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  expect(choices).toEqual([undefined, { deletePhotos: true }]);
});
