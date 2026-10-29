import { expect, test } from "./fixtures";

test("public pages expose the footer, practical rules and draft policies on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /A little less\.\s*A little closer\./,
  );
  const hero = page.locator(".margin-public-hero");
  const illustration = page.getByRole("figure", {
    name: "Example post and conversation",
  });
  await expect(hero.getByRole("link", { name: "Coming soon" })).toBeVisible();
  await expect(illustration).toContainText("That’s everything for now.");
  const photo = illustration.getByRole("img");
  await expect(photo).toHaveAttribute("src", /long-way-round/);
  await expect(photo).toHaveAttribute("loading", "eager");
  await expect(photo).toHaveJSProperty("complete", true);
  expect(
    await photo.evaluate((node: HTMLImageElement) => node.naturalWidth),
  ).toBeGreaterThan(0);
  const copyBounds = (await page
    .locator(".margin-welcome-copy")
    .boundingBox())!;
  const previewBounds = (await illustration.boundingBox())!;
  if (page.viewportSize()!.width >= 1024) {
    expect(previewBounds.x).toBeGreaterThan(copyBounds.x + copyBounds.width);
  } else {
    expect(previewBounds.y).toBeGreaterThan(copyBounds.y + copyBounds.height);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await hero.getByRole("link", { name: "Coming soon" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "margin is coming soon.",
  );
  await expect(
    page.getByRole("heading", { name: "Registration isn’t open yet" }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await page.getByRole("link", { name: "How margin will work" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How margin works",
  );
  const footer = page.getByRole("navigation", { name: "Footer", exact: true });
  await footer.getByRole("link", { name: "How it works" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How margin works",
  );
  await expect(
    page.getByText(
      "Comments and private messages do not count toward this limit.",
    ),
  ).toBeVisible();
  await expect(page.getByText(/minimum signup age is 18/)).toBeVisible();
  await page
    .getByRole("navigation", { name: "Footer", exact: true })
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Policy draft status" }),
  ).toContainText("support@example.com");
  await expect(
    page.getByRole("complementary", { name: "Policy draft status" }),
  ).toContainText("legal operator has not been confirmed");
  expect(await page.locator("form, iframe, audio, video").count()).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
