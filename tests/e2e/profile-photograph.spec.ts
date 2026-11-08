import { captureScreenshot, expect, test } from "./fixtures";
import { identity, memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixtures"),
);

test("gallery file selection uses the branded control with paired, reachable footer actions", async ({
  page,
}, info) => {
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=gallery");
  await page.getByRole("button", { name: "Add photo", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Add Photograph",
    exact: true,
  });
  const input = dialog.getByLabel("Photograph", { exact: true });
  await expect(input).toHaveClass("margin-upload-native");
  await expect(
    dialog.getByText("Choose photograph", { exact: true }),
  ).toBeVisible();
  const upload = dialog.getByRole("button", {
    name: "Upload photograph",
    exact: true,
  });
  await expect(upload).toBeDisabled();
  await input.setInputFiles("src/assets/fixtures/tea.jpg");
  await expect(dialog.getByRole("status")).toHaveText("tea.jpg");
  await expect(upload).toBeEnabled();
  await expect(
    dialog.locator(".margin-photo-picker-footer").getByRole("button"),
  ).toHaveCount(2);
  await captureScreenshot(page, {
    path: info.outputPath("gallery-upload-control.png"),
  });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("portrait framing supports keyboard, drag, touch, retry and a single saved crop", async ({
  page,
  isMobile,
}, info) => {
  await memberFixture(page);
  let calls = 0;
  let saved:
    | { photoId: string; crop: { x: number; y: number; zoom: number } }
    | undefined;
  await page.route(
    "**/__member_fixture/api/profiles/me/portrait",
    async (route) => {
      calls++;
      saved = route.request().postDataJSON();
      await route.fulfill(
        calls === 1
          ? { status: 503, json: { error: "Please try again." } }
          : { json: identity },
      );
    },
  );
  await page.goto("/preview/auth?view=member&area=profile-featured-1");
  await page.getByRole("button", { name: /More options for/ }).click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Change profile photograph", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Your Profile Photograph",
    exact: true,
  });
  await dialog.locator(".margin-photo-library button").first().click();
  const save = dialog.getByRole("button", {
    name: "Use photograph",
    exact: true,
  });
  if (isMobile) {
    const description = dialog.locator(".margin-photo-picker-header p");
    await expect(description).toHaveCSS("font-size", "12px");
  }

  await expect(save).toBeEnabled();
  const zoom = dialog.getByRole("slider", { name: "Zoom", exact: true });
  await zoom.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await expect(zoom).toHaveValue("1.1");
  const crop = dialog.locator(".margin-portrait-crop");
  const box = (await crop.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 20, {
    steps: 5,
  });
  await page.mouse.up();
  const vertical = dialog.getByRole("slider", {
    name: "Vertical position",
    exact: true,
  });
  expect(Number(await vertical.inputValue())).toBeGreaterThan(0.5);
  const afterDrag = Number(await vertical.inputValue());
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 100, y: box.y + 100 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 100, y: box.y + 120 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect(Number(await vertical.inputValue())).toBeLessThan(afterDrag);
  await touch.detach();
  await dialog
    .getByRole("button", { name: "Reset framing", exact: true })
    .click();
  await expect(zoom).toHaveValue("1");
  await expect(vertical).toHaveValue("0.5");
  await zoom.focus();
  await page.keyboard.press("ArrowRight");
  await save.click();
  await expect(dialog.getByRole("alert")).toContainText("Please try again");
  await expect(zoom).toHaveValue("1.01");
  expect(saved?.crop.zoom).toBe(1.01);
  await captureScreenshot(page, {
    path: info.outputPath("portrait-framing.png"),
  });
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect(calls).toBe(2);
  expect(saved?.photoId).toBe("featured-photo-1");
  expect(saved?.crop).toEqual({ x: 0.5, y: 0.5, zoom: 1.01 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
