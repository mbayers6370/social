import { expect, test } from "./fixtures";

test("Spaces stays readable, keeps posts close, and preserves an interrupted composer", async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development Spaces preview",
  );
  await page.goto("/preview/spaces");
  await expect(page.getByRole("button", { name: "New Space" })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath("spaces-directory.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await expect(
    page.getByRole("heading", { name: "Japan 2027", exact: true }),
  ).toBeVisible();
  const about = page.locator(".margin-space-overview");
  const options = page.locator(".margin-space-options");
  const sidebar = page.locator(".margin-space-sidebar");
  const stream = page.locator(".margin-space-stream");
  if (info.project.name === "mobile") {
    await expect(about).toBeVisible();
    await expect(options).not.toHaveAttribute("open", "");
    const first = await page.getByRole("article").first().boundingBox();
    const composer = await page.locator(".margin-space-composer").boundingBox();
    expect(composer!.y + composer!.height).toBeLessThan(first!.y);
  } else {
    await expect(about).toBeVisible();
    await expect(options).not.toHaveAttribute("open", "");
    const a = await sidebar.boundingBox();
    const b = await stream.boundingBox();
    expect(a!.x + a!.width).toBeLessThan(b!.x);
  }
  await page.screenshot({
    path: info.outputPath("space-reading-layout.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.getByText("Members", { exact: true }).click();
  const actions = page.getByRole("group", {
    name: "Actions for Theo Marchetti",
  });
  await expect(
    actions.getByRole("button", { name: "Block Theo Marchetti", exact: true }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", {
      name: "Make Theo Marchetti an administrator",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", {
      name: "Remove Theo Marchetti from Space",
      exact: true,
    }),
  ).toBeVisible();
  for (const button of await actions.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const share = page.getByRole("button", { name: "Share a thought…" });
  await share.click();
  await page
    .getByLabel("Your post", { exact: true })
    .fill("A thought to finish later.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await share.click();
  await expect(page.getByLabel("Your post", { exact: true })).toHaveValue(
    "A thought to finish later.",
  );
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => {
      document.documentElement.dataset.readingSize = "extra-large";
    });
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
