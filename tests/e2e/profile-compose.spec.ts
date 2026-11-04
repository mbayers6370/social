import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development profile fixtures",
  ),
);

for (const profile of ["local", "member"] as const) {
  test(`${profile} profile opens New Post in a desktop modal and a full-screen phone dialog`, async ({
    page,
    isMobile,
  }, info) => {
    if (profile === "member") await memberFixture(page);
    await page.goto(
      profile === "member"
        ? "/preview/auth?view=member&area=profile"
        : "/?view=profile",
    );
    const trigger = page.getByRole("button", { name: "New Post", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "New Post", exact: true });
    const input = dialog.getByRole("textbox", { name: "Your post" });
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("rows", "3");
    await expect(
      dialog.locator(".margin-compose-author .margin-avatar"),
    ).toBeVisible();
    await expect(
      dialog.locator(".margin-compose-writing .margin-avatar"),
    ).toHaveCount(0);
    const viewport = page.viewportSize()!;
    const bounds = (await dialog.boundingBox())!;
    if (isMobile) {
      expect(bounds.width).toBeCloseTo(viewport.width, 0);
      expect(bounds.height).toBeCloseTo(viewport.height, 0);
    } else {
      expect(bounds.width).toBeLessThanOrEqual(680);
      expect(bounds.height).toBeLessThanOrEqual(viewport.height * 0.9 + 1);
      expect(bounds.x).toBeGreaterThan(0);
      expect(bounds.y).toBeGreaterThan(0);
      // clientWidth becomes the viewport width during scroll lock on Linux,
      // even while the stable scrollbar gutter reserves layout space. Measure
      // the actual root box, which is also the dialog's containing area.
      const content = (await page.locator("html").boundingBox())!;
      expect(bounds.x + bounds.width / 2).toBeCloseTo(
        content.x + content.width / 2,
        0,
      );
      expect(bounds.y + bounds.height / 2).toBeCloseTo(viewport.height / 2, 0);
    }
    await input.fill("A thought from my profile.");
    await captureScreenshot(page, {
      path: info.outputPath("profile-compose.png"),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(
      dialog.getByRole("textbox", { name: "Your post" }),
    ).toHaveValue("A thought from my profile.");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(trigger).toBeFocused();
  });

  test(`${profile} profile keeps chosen device photographs in the post draft`, async ({
    page,
  }, info) => {
    if (profile === "member") await memberFixture(page);
    await page.goto(
      profile === "member"
        ? "/preview/auth?view=member&area=profile"
        : "/?view=profile",
    );
    await page.getByRole("button", { name: "New Post", exact: true }).click();
    const compose = page.getByRole("dialog", { name: "New Post", exact: true });
    for (let index = 0; index < 3; index++) {
      await compose.getByRole("button", { name: /^Add photographs?$/ }).click();
      const picker = page.getByRole("dialog", { name: "Choose a photograph" });
      await picker
        .getByLabel("Or upload a new one")
        .setInputFiles("src/assets/fixtures/tea.jpg");
      await expect
        .poll(() =>
          picker
            .locator(".margin-dropped-photo")
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await picker
        .getByRole("button", { name: "Use photograph", exact: true })
        .click();
      await expect(picker).toHaveCount(0);
      await expect(compose.locator(".margin-compose-photos img")).toHaveCount(
        index + 1,
      );
      await expect
        .poll(() =>
          compose
            .locator(".margin-compose-photos img")
            .last()
            .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    }
    await captureScreenshot(page, {
      path: info.outputPath("profile-photo-draft.png"),
    });
    await compose.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "New Post", exact: true }).click();
    await expect(compose.locator(".margin-compose-photos img")).toHaveCount(3);
  });
}
