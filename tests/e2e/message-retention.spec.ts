import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Local rendering fixtures",
  );
});

for (const example of [
  {
    name: "preview messages",
    url: "/?view=messages&thread=theo",
    notebook: false,
  },
  { name: "Notebook", url: "/?view=messages&thread=ines", notebook: true },
  {
    name: "member messages",
    url: "/preview/auth?view=member&area=messages&thread=fictional-friend",
    notebook: false,
  },
]) {
  test(`keeps ${example.name} lifetime guidance and composing controls visible`, async ({
    page,
    isMobile,
  }, info) => {
    await memberFixture(page);
    await page.setViewportSize(
      isMobile ? { width: 320, height: 700 } : { width: 1280, height: 600 },
    );
    await page.goto(example.url);
    const notice = page.locator(".margin-message-retention");
    const copy = example.notebook
      ? "Notes expire 90 days after saving."
      : "Messages expire 30 days after sending.";
    await expect(page.locator("#message-retention")).toHaveText(copy);
    if (!example.notebook)
      await expect(
        notice.getByRole("button", { name: "Export conversation" }),
      ).toBeVisible();
    await expect(notice).toBeInViewport({ ratio: 1 });
    const history = page.getByRole("region", {
      name: example.notebook ? "Notebook history" : "Message history",
      exact: true,
    });
    await expect(history).toHaveAccessibleDescription(copy);
    const input = page.locator(".margin-message-composer textarea");
    await input.fill(
      "A draft to check the available writing space. ".repeat(8),
    );
    await expect(input).toBeInViewport({ ratio: 1 });
    await expect(
      page.locator(".margin-message-composer button[type=submit]"),
    ).toBeInViewport({ ratio: 1 });
    expect((await history.boundingBox())!.height).toBeGreaterThan(0);
    await expect(notice).toBeInViewport({ ratio: 1 });
    await captureScreenshot(page, {
      path: info.outputPath("retention-guidance.png"),
      caret: "initial",
    });
    expect(await page.pageErrors()).toEqual([]);
  });
}
