import { test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development member fixture",
  ),
);

test("spaces Settings groups and account actions on desktop and mobile, including larger text", async ({
  page,
}, info) => {
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=settings");
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-size",
    "standard",
  );
  const content = page.locator(".margin-settings-page");
  await expect(
    page.getByRole("checkbox", { name: "Likes Activity on your posts" }),
  ).not.toBeChecked();
  await expect(
    content.locator("summary").filter({ hasText: "Blocked people" }),
  ).toHaveText("Blocked peopleNone");
  await expect(
    content.locator("summary").filter({ hasText: "Your reports" }),
  ).toHaveText("Your reportsNone");
  await expect(
    content.getByText(
      "You can change your username once. After that, it’s permanent.",
    ),
  ).toBeVisible();
  await expect(content.locator("#messaging-settings")).toContainText(
    "Messages are deleted after 30 days. You can export any conversation.",
  );
  await expect(content.locator("#messaging-settings")).toContainText(
    "Notebook is your private space for notes to yourself",
  );
  const opening = content.locator(".margin-settings-opening");
  const columns = content.locator(".margin-settings-columns");
  const title = content.getByRole("heading", {
    name: "Reading & motion",
    exact: true,
  });
  expect(
    (await title.boundingBox())!.y -
      ((await opening.boundingBox())!.y +
        (await opening.boundingBox())!.height),
  ).toBeGreaterThanOrEqual(0);
  expect(
    (await columns.boundingBox())!.y -
      ((await opening.boundingBox())!.y +
        (await opening.boundingBox())!.height),
  ).toBeLessThanOrEqual(2);
  const account = content.locator(".margin-account-controls");
  const data = content.locator(".margin-settings-data");
  expect(
    (await data.boundingBox())!.y -
      ((await account.boundingBox())!.y +
        (await account.boundingBox())!.height),
  ).toBeGreaterThanOrEqual(23);
  const profile = content.locator(".margin-settings-profile");
  expect((await profile.boundingBox())!.width).toBeLessThanOrEqual(
    (await content.boundingBox())!.width,
  );
  await page.screenshot({
    path: info.outputPath("settings-spacing.png"),
    fullPage: true,
    caret: "initial",
  });
  await page.getByRole("radio", { name: "Extra large", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-size",
    "extra-large",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByText("Account removal", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Deactivate account", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("settings-larger-text.png"),
    fullPage: true,
    caret: "initial",
  });
});

test("keeps public Help readable with signed-out navigation and no account mutations", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      mutations.push(new URL(request.url()).pathname);
  });
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Footer", exact: true })
    .getByRole("link", { name: "Privacy", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(mutations).toEqual([]);
});
