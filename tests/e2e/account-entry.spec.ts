import { captureScreenshot, expect, test } from "./fixtures";
test("welcome connects invitation signup and login", async ({
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
  ).toHaveCount(0);
  await expect(page.getByText(/coming soon/i)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    navigation.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCSS("border-top-width", "1px");
  const membership = page
    .getByRole("link", { name: "Membership by invitation", exact: true })
    .first();
  await expect(membership).toHaveAttribute("href", "/how-it-works");
  await Promise.all([page.waitForURL(/\/how-it-works$/), membership.click()]);
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  await page.goto("/sign-up");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(/Open the invitation link someone sent you/),
  ).toBeVisible();
  await captureScreenshot(page, {
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
  await captureScreenshot(page, {
    path: `test-results/sign-in-${testInfo.project.name}.png`,
  });
  await expect(
    page.getByRole("link", { name: "Join Margin", exact: true }),
  ).toHaveCount(0);
  await page.goto("/sign-up");
  if (process.env.PLAYWRIGHT_PRODUCTION === "1") {
    await expect(
      page.getByRole("link", { name: "Preview profile setup", exact: true }),
    ).toHaveCount(0);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/sign-in$/);
    return;
  }
  await expect(
    page.getByRole("link", { name: "Preview profile setup", exact: true }),
  ).toBeVisible();
});

test("invitation signup opens the fictional profile setup and completes it", async ({
  page,
}) => {
  // A fresh CI server compiles signup, onboarding and the feed on this journey.
  // Keep compiler startup outside the normal five-second UI assertion budget.
  test.setTimeout(60_000);
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Profile setup fixture is development-only",
  );
  await page.goto("/sign-up");
  const preview = page.getByRole("link", {
    name: "Preview profile setup",
    exact: true,
  });
  const href = await preview.getAttribute("href");
  expect(href).toBeTruthy();
  await Promise.all([
    page.waitForURL((url) => url.pathname + url.search === href),
    preview.click(),
  ]);
  await page.getByLabel("Your name", { exact: true }).fill("Alex River");
  await page.getByLabel("Username", { exact: true }).fill("alexriver");
  await page.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/" && !url.search),
    page.getByRole("button", { name: "Start your space" }).click(),
  ]);
  await expect(
    page.getByRole("heading", { name: "It starts with your people." }),
  ).toBeVisible();
});
test("account exit is visible in the menu and reporting lives in post options", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Account-free feed fixtures are development-only",
  );
  await page.goto("/");
  const post = page.locator("#post-book");
  await post.getByRole("button", { name: /Post options for/ }).click();
  await expect(
    post.getByRole("menuitem", { name: "Report post", exact: true }),
  ).toHaveText("Report post");
  await page.keyboard.press("Escape");
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
  await captureScreenshot(page, {
    path: `test-results/account-menu-${testInfo.project.name}.png`,
  });
  await menu.getByRole("button", { name: "Exit preview", exact: true }).click();
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A little less.A little closer.",
  );
  await page.goto("/join");
  await expect(page).toHaveURL(/\/how-it-works$/);
});
