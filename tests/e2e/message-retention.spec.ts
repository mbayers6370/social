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

for (const example of [
  {
    name: "member conversation",
    url: "/preview/auth?view=member&area=messages&thread=fictional-friend",
  },
  {
    name: "member Notebook",
    url: "/preview/auth?view=member&area=messages&thread=fictional-member",
  },
  { name: "preview conversation", url: "/?view=messages&thread=theo" },
  { name: "preview Notebook", url: "/?view=messages&thread=ines" },
]) {
  test(`reflows ${example.name} with every reading size and enlarged text`, async ({
    page,
    isMobile,
  }, info) => {
    await memberFixture(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: isMobile ? 320 : 390, height: 844 });
    await page.goto(example.url);
    const header = page.locator(".margin-thread-header");
    await expect(header).toBeVisible();
    const contact = await header.getByRole("heading").innerText();
    await expect(page.locator(".margin-message-retention")).toHaveCSS(
      "font-size",
      "10px",
    );
    await page.evaluate(() => document.fonts.ready);
    for (const size of ["standard", "larger", "extra-large"]) {
      for (const scale of [1, 2]) {
        await page.evaluate(
          ({ size, scale }) => {
            document.documentElement.dataset.readingSize = size;
            document.documentElement.style.fontSize = `${scale * 100}%`;
            return new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
          },
          { size, scale },
        );
        const heading = header.getByRole("heading");
        const name = await heading.evaluate((node) => ({
          height: node.getBoundingClientRect().height,
          line: parseFloat(getComputedStyle(node).lineHeight),
        }));
        expect(name.height).toBeLessThanOrEqual(name.line * 2 + 1);
        await header.scrollIntoViewIfNeeded();
        await expect(header).toBeInViewport({ ratio: 1 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(page.viewportSize()!.width);
        const history = page.locator(".margin-thread-scroll");
        expect((await history.boundingBox())!.height).toBeGreaterThan(80);
        await history.scrollIntoViewIfNeeded();
        await expect(history).toBeInViewport({ ratio: 1 });
        const input = page.locator(".margin-message-input textarea");
        await input.fill("A draft worth keeping.");
        await expect(input).toBeInViewport({ ratio: 1 });
        await expect(
          page.locator(".margin-message-input button[type=submit]"),
        ).toBeInViewport({ ratio: 1 });
      }
    }
    await captureScreenshot(page, {
      path: info.outputPath("enlarged-message-layout.png"),
      caret: "initial",
    });
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("font-size");
      document.documentElement.dataset.readingSize = "standard";
    });
    await header
      .getByRole("button", { name: "Back to messages", exact: true })
      .click();
    await expect(page.locator(".margin-inbox")).toBeVisible();
    const draft = example.name.includes("Notebook")
      ? page.getByRole("button", { name: /Open notebook/ })
      : page.getByRole("button", {
          name: `Open conversation with ${contact}`,
          exact: true,
        });
    await draft.click();
    await expect(page.locator(".margin-message-input textarea")).toHaveValue(
      "A draft worth keeping.",
    );
  });
}
