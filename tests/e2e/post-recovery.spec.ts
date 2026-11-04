import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

type PublishAttempt = {
  input: string;
  descriptions: boolean;
  photos: number;
  size: number;
  digest: string;
};
declare global {
  interface Window {
    marginPublishAttempts: PublishAttempt[];
  }
}

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
    browserName,
  }, info) => {
    const bytes = readFileSync("src/assets/fixtures/tea.jpg");
    const expectedDigest = createHash("sha256").update(bytes).digest("hex");
    const wireDigests: string[] = [];
    let publishes = 0;
    // Observe the actual FormData passed to fetch without changing it. WebKit's
    // interception protocol omits file bytes from request.postDataBuffer().
    // Digests also keep a failed byte assertion from dumping the whole image.
    await page.addInitScript(() => {
      window.marginPublishAttempts = [];
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (resource, init) => {
        const url =
          resource instanceof Request ? resource.url : String(resource);
        if (
          url.endsWith("/__member_fixture/api/posts/publish") &&
          init?.body instanceof FormData
        ) {
          const form = init.body;
          const file = form.get("photos") as File;
          const hash = await crypto.subtle.digest(
            "SHA-256",
            await file.arrayBuffer(),
          );
          window.marginPublishAttempts.push({
            input: String(form.get("input")),
            descriptions: form.has("descriptions"),
            photos: form.getAll("photos").length,
            size: file.size,
            digest: Array.from(new Uint8Array(hash), (value) =>
              value.toString(16).padStart(2, "0"),
            ).join(""),
          });
        }
        return originalFetch(resource, init);
      };
    });
    await page.route("**/__member_fixture/api/posts/publish", async (route) => {
      publishes++;
      // Keep the original encoded-multipart assertion where the protocol
      // exposes file bytes. Every engine also checks the actual fetch File.
      if (browserName !== "webkit") {
        const form = await new Request("http://localhost/upload", {
          method: "POST",
          headers: {
            "Content-Type": route.request().headers()["content-type"],
          },
          body: new Uint8Array(route.request().postDataBuffer()!),
        }).formData();
        wireDigests.push(
          createHash("sha256")
            .update(
              new Uint8Array(await (form.get("photos") as File).arrayBuffer()),
            )
            .digest("hex"),
        );
      }
      return publishes === 1
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
    expect(publishes).toBe(1);
    await captureScreenshot(page, {
      path: info.outputPath("recovered-draft.png"),
    });
    await resume.click();
    await expect(input).toBeFocused();
    await expect(input).toBeEditable();
    expect(publishes).toBe(1);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await expect(page.locator(".margin-compose-form")).toHaveCount(0);
    expect(publishes).toBe(2);
    const attempts = await page.evaluate(() => window.marginPublishAttempts);
    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) {
      expect(JSON.parse(attempt.input)).toEqual({
        body: "Keep this thought and its photograph.",
        photoIds: [],
      });
      expect(attempt.descriptions).toBe(false);
      expect(attempt.photos).toBe(1);
      expect(attempt.size).toBe(bytes.length);
      expect(attempt.digest).toBe(expectedDigest);
    }
    if (browserName !== "webkit")
      expect(wireDigests).toEqual([expectedDigest, expectedDigest]);
  });
}
