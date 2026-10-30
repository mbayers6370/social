import { expect, test } from "./fixtures";
test("welcome connects invitation signup, login and local profile setup", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/welcome");
  const navigation = page.getByRole("navigation", {
    name: "Public navigation",
  });
  await expect(
    navigation.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Join Margin", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".margin-welcome-cta").click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByLabel("Your invitation code")).toBeVisible();
  await page.screenshot({
    path: `test-results/invitation-signup-${testInfo.project.name}.png`,
  });
  await page
    .getByRole("link", { name: "Sign in", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome back.",
  );
  await expect(
    page.getByText(
      process.env.PLAYWRIGHT_PRODUCTION === "1"
        ? "Sign-in is temporarily unavailable."
        : "Live sign-in isn’t available in this preview.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/sign-in-${testInfo.project.name}.png`,
  });
  await page.getByRole("link", { name: "Join Margin", exact: true }).click();
  if (process.env.PLAYWRIGHT_PRODUCTION === "1") {
    await expect(
      page.getByRole("link", { name: "Preview profile setup", exact: true }),
    ).toHaveCount(0);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/sign-in$/);
    return;
  }
  await page
    .getByRole("link", { name: "Preview profile setup", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex River");
  await page.getByLabel("Username", { exact: true }).fill("alexriver");
  await page.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await page.getByRole("button", { name: "Start your space" }).click();
  await expect(
    page.getByRole("heading", { name: "It starts with your people." }),
  ).toBeVisible();
});
test("account exit is visible in the menu and post flags stay quiet", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Account-free feed fixtures are development-only",
  );
  await page.goto("/");
  const flag = page
    .locator(".margin-feed-post")
    .first()
    .getByRole("button", { name: "Report post" });
  await expect(flag).toHaveCSS("color", "rgb(139, 144, 146)");
  await expect(flag).toHaveText("");
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  const menu = page.getByRole("navigation", {
    name: "Profile menu",
    exact: true,
  });
  await expect(
    menu.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Exit preview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/account-menu-${testInfo.project.name}.png`,
  });
  await menu.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little less.A little closer.",
  );
  await page.goto("/join");
  await expect(page).toHaveURL(/\/sign-up$/);
});
