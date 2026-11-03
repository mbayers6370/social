import { test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";
import { readFileSync } from "node:fs";

test.describe("shared member feed presentation and personal composer", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.PLAYWRIGHT_PRODUCTION === "1",
      "Fictional rendering fixture is development-only",
    ),
  );
  test.beforeEach(async ({ page }) => memberFixture(page));
  test.afterEach(async ({ page }) => {
    expect(await page.pageErrors()).toEqual([]);
  });

  test("provides a readable profile menu and a useful empty feed on desktop and mobile", async ({
    page,
  }, info) => {
    await page.goto("/preview/auth?view=member");
    await expect(
      page.getByRole("heading", { name: "It starts with your people." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share a thought…" }),
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "Profile menu" });
    await trigger.click();
    const menu = page.getByRole("navigation", { name: "Profile menu" });
    await expect(
      menu.getByRole("link", { name: "View profile" }),
    ).toHaveAttribute("href", "/app");
    await expect(menu.getByRole("link", { name: "Friends" })).toHaveAttribute(
      "href",
      "/app/friends",
    );
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      caret: "initial",
      path: info.outputPath("member-feed.png"),
      fullPage: true,
    });
  });

  test("preserves a draft after cancellation and rejection, then publishes without a client identity", async ({
    page,
  }, info) => {
    let reject = true;
    const payloads: unknown[] = [];
    await page.route("**/__member_fixture/api/posts/publish", (route) => {
      payloads.push(route.request().postDataJSON());
      return route.fulfill(
        reject
          ? { status: 409, json: { error: "Daily post allowance reached" } }
          : { status: 201, json: {} },
      );
    });
    await page.goto("/preview/auth?view=member");
    const trigger = page.getByRole("button", { name: "Share a thought…" });
    await trigger.click();
    await page.getByLabel("Your post").fill("A thought for friends");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.getByLabel("Your post")).toHaveValue(
      "A thought for friends",
    );
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Daily post allowance reached" }),
    ).toContainText("Daily post allowance reached");
    await expect(page.getByLabel("Your post")).toHaveValue(
      "A thought for friends",
    );
    await page.screenshot({
      caret: "initial",
      path: info.outputPath("member-composer.png"),
      fullPage: true,
    });
    reject = false;
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Post shared with friends." }),
    ).toContainText("Post shared with friends.");
    expect(payloads).toEqual([
      { body: "A thought for friends", photoIds: [] },
      { body: "A thought for friends", photoIds: [] },
    ]);
    await expect(page.getByRole("article")).toHaveCount(0);
  });

  test("keeps uncertain submissions from creating duplicates across closing and reopening", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/__member_fixture/api/posts/publish", (route) => {
      calls++;
      return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    });
    await page.goto("/preview/auth?view=member");
    const trigger = page.getByRole("button", { name: "Share a thought…" });
    await trigger.click();
    await page.getByLabel("Your post").fill("Keep this draft");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page.getByRole("button", { name: "Reload to check saved changes" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();
    await expect(page.getByLabel("Your post")).toHaveValue("Keep this draft");
    expect(calls).toBe(1);
  });

  test("reviews a device photograph before publishing its bytes and Unicode description together", async ({
    page,
  }) => {
    const bytes = readFileSync("src/assets/fixtures/tea.jpg");
    let calls = 0;
    let description: FormDataEntryValue | null = null;
    let uploaded: Uint8Array | undefined;
    await page.route("**/__member_fixture/api/posts/publish", async (route) => {
      calls++;
      const form = await new Request("http://localhost/upload", {
        method: "POST",
        headers: { "Content-Type": route.request().headers()["content-type"] },
        body: new Uint8Array(route.request().postDataBuffer()!),
      }).formData();
      expect(JSON.parse(String(form.get("input")))).toEqual({
        body: "A photograph for friends",
        photoIds: [],
      });
      description = form.get("descriptions");
      uploaded = new Uint8Array(
        await (form.get("photos") as File).arrayBuffer(),
      );
      return route.fulfill({ status: 201, json: { id: "saved-photo-post" } });
    });
    await page.goto("/preview/auth?view=member");
    await page.getByRole("button", { name: "New photo post" }).click();
    const picker = page.getByRole("dialog", { name: "Choose a photograph" });
    await picker.locator('input[type="file"]').setInputFiles({
      name: "tea.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });
    await picker
      .getByLabel("Describe the photograph (alt text)")
      .fill("Une rivière");
    await expect(picker.locator(".margin-dropped-photo")).toBeVisible();
    await expect
      .poll(() =>
        picker.locator(".margin-dropped-photo").evaluate((node) => {
          const image = node as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
    await picker
      .getByRole("button", { name: "Use Photograph", exact: true })
      .click();
    expect(calls).toBe(0);
    const attachment = page.locator(".margin-compose-photo > img");
    await attachment.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        attachment.evaluate((node) => {
          const image = node as HTMLImageElement;
          return image.complete && image.naturalWidth > 0;
        }),
      )
      .toBe(true);
    const bounds = (await attachment.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(120);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Share a thought…" }).click();
    await expect(attachment).toBeVisible();
    expect(
      await attachment.evaluate(
        (node) => (node as HTMLImageElement).naturalWidth,
      ),
    ).toBeGreaterThan(0);
    await page.getByLabel("Your post").fill("A photograph for friends");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Post shared with friends." }),
    ).toBeVisible();
    expect(calls).toBe(1);
    expect(description).toBe("Une rivière");
    expect(Buffer.from(uploaded!)).toEqual(bytes);
  });
});
