import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Member rendering fixture",
  );
  await memberFixture(page);
});

for (const area of ["profile", "feed"] as const) {
  test(`${area} recovery keeps text and device photos while refreshing saved posts`, async ({
    page,
  }, info) => {
    const bytes = readFileSync("src/assets/fixtures/tea.jpg");
    const attempts: FormData[] = [];
    await page.route("**/__member_fixture/api/posts/publish", async (route) => {
      attempts.push(
        await new Request("http://localhost/upload", {
          method: "POST",
          headers: {
            "Content-Type": route.request().headers()["content-type"],
          },
          body: new Uint8Array(route.request().postDataBuffer()!),
        }).formData(),
      );
      return attempts.length === 1
        ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
        : route.fulfill({ status: 201, json: { id: "saved-post" } });
    });
    await page.goto(`/preview/auth?view=member&area=${area}`);
    await page
      .getByRole("button", {
        name: area === "profile" ? "New Post" : "Share a thought…",
        exact: true,
      })
      .click();
    const input = page.getByRole("textbox", { name: "Your post" });
    await input.fill("Keep this thought and its photograph.");
    await page
      .getByRole("button", { name: "Add photographs", exact: true })
      .click();
    const picker = page.getByRole("dialog", { name: "Choose a photograph" });
    await picker.getByLabel("Or upload a new one").setInputFiles({
      name: "tea.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });
    await picker
      .getByRole("button", { name: "Use photograph", exact: true })
      .click();
    const photo = page.locator(".margin-compose-photos img");
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    const src = await photo.getAttribute("src");
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Check saved posts", exact: true }),
    ).toBeVisible();
    const documents: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url());
    });
    await page
      .getByRole("button", { name: "Check saved posts", exact: true })
      .click();
    const resume = page.getByRole("button", {
      name: "Continue editing draft",
      exact: true,
    });
    await expect(resume).toBeEnabled();
    await expect(input).toHaveValue("Keep this thought and its photograph.");
    await expect(photo).toHaveAttribute("src", src!);
    await expect(photo).toHaveAttribute("alt", "Selected photograph");
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: "Publish", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "View published posts (new tab)" }),
    ).toHaveAttribute("target", "_blank");
    expect(documents).toEqual([]);
    expect(attempts).toHaveLength(1);
    await page.screenshot({ path: info.outputPath("recovered-draft.png") });
    await resume.click();
    await expect(input).toBeFocused();
    await expect(input).toBeEditable();
    expect(attempts).toHaveLength(1);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.locator(".margin-compose-form")).toHaveCount(0);
    expect(attempts).toHaveLength(2);
    for (const form of attempts) {
      expect(JSON.parse(String(form.get("input")))).toEqual({
        body: "Keep this thought and its photograph.",
        photoIds: [],
      });
      expect(form.get("descriptions")).toBeNull();
      expect(
        Buffer.from(await (form.get("photos") as File).arrayBuffer()),
      ).toEqual(bytes);
    }
  });
}
