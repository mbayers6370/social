import { captureScreenshot, expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

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
  await captureScreenshot(page, {
    path: info.outputPath("spaces-directory.png"),
    fullPage: true,
    caret: "initial",
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your spaces",
  );
  const planned = page
    .getByRole("list", { name: "Your Spaces" })
    .getByRole("link", { name: /Japan 2027/ });
  await expect(planned.locator(".margin-space-date")).toHaveCSS(
    "font-size",
    "12px",
  );
  if (info.project.name !== "mobile") {
    const title = await planned
      .getByRole("heading", { name: "Japan 2027" })
      .boundingBox();
    const date = await planned.locator(".margin-space-date").boundingBox();
    expect(date!.x).toBeGreaterThan(title!.x + title!.width);
  }
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => {
      document.documentElement.dataset.readingSize = "extra-large";
    });
  }
  const cards = page
    .getByRole("list", { name: "Your Spaces" })
    .getByRole("link");
  for (const card of await cards.all()) {
    const bounds = await card.boundingBox();
    const arrow = await card.locator(".margin-space-row-arrow").boundingBox();
    expect(
      Math.abs(arrow!.y + arrow!.height / 2 - (bounds!.y + bounds!.height / 2)),
    ).toBeLessThan(1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
  await captureScreenshot(page, {
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

test("Spaces welcomes a member with no groups and restores focus after exploring creation", async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development member fixture",
  );
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=spaces");
  await expect(
    page.getByRole("heading", { name: "A little room for your people." }),
  ).toBeVisible();
  if (info.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 740 });
  }
  const create = page.getByRole("button", { name: "New Space", exact: true });
  await create.click();
  await expect(
    page.getByRole("dialog", { name: "Create a Space" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(create).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
