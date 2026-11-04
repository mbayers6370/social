import { captureScreenshot, test, expect } from "./fixtures";

test("keeps registration closed and fails closed on protected requests without authentication services", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("status")).toContainText(
    "Registration is currently closed",
  );
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toHaveCount(0);
  const result = await page.request.get("/api/account", {
    headers: { "x-user-id": "forged-user", "x-margin-preview": "1" },
  });
  expect(result.status()).toBe(503);
  expect(result.headers()["cache-control"]).toBe("private, no-store");
  expect(await result.text()).not.toContain("forged-user");
  const protectedPage = await page.goto("/app");
  expect(protectedPage?.status()).toBe(503);
  await expect(
    page.getByRole("heading", { name: "Account access is unavailable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to sign in" }),
  ).toBeVisible();
  if (process.env.PLAYWRIGHT_PRODUCTION === "1") {
    const fixture = await page.request.get("/preview/auth");
    expect(fixture.status()).toBe(404);
    const onboardingFixture = await page.request.get("/preview/onboarding");
    expect(onboardingFixture.status()).toBe(404);
  }
});

test.describe("fictional account access UI; real session endpoint is never bypassed", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.PLAYWRIGHT_PRODUCTION === "1",
      "The fixture is development-only",
    ),
  );
  test("hides protected content after revocation and handles temporary outages with retry", async ({
    page,
  }, info) => {
    let status = 200;
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status,
        json:
          status === 200
            ? { sessionId: "fictional-session" }
            : { error: "Unavailable" },
      }),
    );
    await page.goto("/preview/auth");
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toBeVisible();
    status = 503;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Check your connection",
    );
    await captureScreenshot(page, {
      path: info.outputPath("auth-unavailable.png"),
      fullPage: true,
    });
    status = 200;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toBeVisible();
    status = 401;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("heading", { name: "Your session has ended." }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Return to sign in" }),
    ).toHaveAttribute("href", "/sign-in?reason=session-ended");
  });
  test("removes content immediately after the client session ends", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ json: { sessionId: "fictional-session" } }),
    );
    await page.goto("/preview/auth");
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Simulate session ending" }).click();
    await expect(
      page.getByRole("region", { name: "Fictional account" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Your session has ended." }),
    ).toBeVisible();
  });
  test("retains accessible profile fields after an account-setup failure", async ({
    page,
  }, info) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({ json: { sessionId: "fictional-session" } }),
    );
    await page.goto("/preview/auth");
    await page.getByRole("button", { name: "Preview profile form" }).click();
    await page.getByLabel("Your name").fill("Sample member");
    await page.getByLabel("Username", { exact: true }).fill("sample_member");
    await page
      .getByLabel("A little about you (optional)")
      .fill("Sample introduction.");
    await page.getByRole("checkbox", { name: "I am 18 or older." }).check();
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Your details are still here",
    );
    await expect(page.getByLabel("Your name")).toHaveValue("Sample member");
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
      "sample_member",
    );
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Save profile", exact: true }),
    ).toBeEnabled();
    if (info.project.name === "mobile")
      await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await captureScreenshot(page, {
      path: info.outputPath("auth-profile-recovery.png"),
      fullPage: true,
    });
  });
});
