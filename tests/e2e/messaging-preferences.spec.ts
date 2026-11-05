import { captureScreenshot, test, expect } from "./fixtures";
import {
  memberFixture,
  identity,
  friend,
  conversation,
} from "./helpers/member-fixture";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Fictional member UI, protected APIs are not bypassed",
  );
  await memberFixture(page);
});

test("starts messaging on, recovers a failed opt-out and restores navigation on opt-in", async ({
  page,
  isMobile,
}, info) => {
  let current = structuredClone(identity),
    attempts = 0;
  await page.route("**/__member_fixture/api/member/context", (route) =>
    route.fulfill({ json: current }),
  );
  await page.route("**/__member_fixture/api/member/preferences", (route) => {
    if (++attempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Settings could not be saved." },
      });
    current = {
      ...current,
      preferences: {
        ...current.preferences,
        ...route.request().postDataJSON(),
      },
    };
    return route.fulfill({ json: current });
  });
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/preview/auth?view=member&area=settings");
  const toggle = page.getByRole("checkbox", { name: /Allow messaging/ });
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobile navigation" : "Primary",
    exact: true,
  });
  await expect(toggle).toBeChecked();
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(
    page.locator(".margin-settings-page").getByRole("alert"),
  ).toHaveText("Settings could not be saved.");
  await expect(toggle).toBeChecked();
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toHaveCount(0);
  if (isMobile) {
    const links = await nav.getByRole("link").all();
    expect(links).toHaveLength(3);
    const widths = await Promise.all(
      links.map(async (link) => (await link.boundingBox())!.width),
    );
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(2);
  }
  await expect(
    page.getByRole("checkbox", { name: /^Messages New private/ }),
  ).toBeDisabled();
  await captureScreenshot(page.locator("#messaging-settings"), {
    path: info.outputPath("messaging-off-setting.png"),
    caret: "initial",
  });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible();
  const help = page.locator(".margin-settings-help");
  const removal = page
    .locator("summary")
    .filter({ hasText: "Account removal" });
  await help.scrollIntoViewIfNeeded();
  const a = (await help.boundingBox())!,
    b = (await removal.boundingBox())!;
  expect(a.y + a.height).toBeLessThanOrEqual(b.y);
  if (!isMobile) {
    const right = (await page
      .locator(".margin-settings-column")
      .nth(1)
      .boundingBox())!;
    expect(a.x).toBeGreaterThanOrEqual(right.x);
    expect(a.x + a.width).toBeLessThanOrEqual(right.x + right.width + 1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await captureScreenshot(page, {
    path: info.outputPath("settings-help-before-removal.png"),
    caret: "initial",
  });
});

test("removes profile messaging for either opt-out, blocks the disabled messaging view and restores profile actions", async ({
  page,
  isMobile,
}, info) => {
  await page.goto(
    "/preview/auth?view=member&area=friend-profile&profileMessaging=off",
  );
  const nav = page.getByRole("navigation", {
    name: isMobile ? "Mobile navigation" : "Primary",
    exact: true,
  });
  await expect(
    page.getByRole("link", { name: `Message ${friend.name}`, exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible();
  const off = {
    ...identity,
    preferences: { ...identity.preferences, messagingEnabled: false },
  };
  await page.route("**/__member_fixture/api/member/context", (route) =>
    route.fulfill({ json: off }),
  );
  await page.goto(
    "/preview/auth?view=member&area=friend-profile&messaging=off",
  );
  await expect(
    page.getByRole("link", { name: `Message ${friend.name}`, exact: true }),
  ).toHaveCount(0);
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toHaveCount(0);
  await page.goto(
    "/preview/auth?view=member&area=messages&messaging=off&thread=fictional-friend",
  );
  await expect(
    page.getByRole("heading", { name: "Messaging is off." }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Message to/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Messaging settings" }),
  ).toHaveAttribute("href", "/app/settings#messaging-settings");
  await captureScreenshot(page, {
    path: info.outputPath("disabled-messaging-route.png"),
    caret: "initial",
  });
  await page.unroute("**/__member_fixture/api/member/context");
  await page.goto("/preview/auth?view=member&area=friend-profile");
  await expect(
    page.getByRole("link", { name: `Message ${friend.name}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `Message ${friend.name}`, exact: true }),
  ).toHaveAttribute("href", `/app/messages?thread=${friend.id}`);
  await expect(
    nav.getByRole("link", { name: "Messages", exact: true }),
  ).toBeVisible();
});

test("stops an already-open composer immediately after the recipient becomes unavailable", async ({
  page,
}, info) => {
  await page.route(
    "**/__member_fixture/api/messages/fictional-friend",
    (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 404,
            json: { error: "This conversation is unavailable." },
          })
        : route.fulfill({ json: conversation }),
  );
  await page.goto(
    "/preview/auth?view=member&area=messages&thread=fictional-friend",
  );
  await page
    .getByRole("textbox", { name: "Message to Alex Example" })
    .fill("A draft to keep");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message to Alex Example" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("See you on Saturday.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open conversation with Alex Example" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("This conversation is unavailable.", { exact: true }),
  ).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("revoked-open-conversation.png"),
    caret: "initial",
  });
});

test("opens a new Space post notification at its protected post destination", async ({
  page,
}, info) => {
  const href = "/app/spaces/our-space?post=shared-post#shared-post";
  await page.route("**/__member_fixture/api/notifications", (route) =>
    route.fulfill({
      json: {
        activity: [
          {
            id: "space-update",
            actor: friend,
            kind: "space_post",
            spaceName: "Dinner plans",
            href,
            createdAt: "2026-11-03T12:00:00Z",
            read: false,
          },
        ],
        nextCursor: null,
      },
    }),
  );
  await page.goto("/preview/auth?view=member&area=spaces");
  await page
    .getByRole("button", { name: "Notifications, 1 unread", exact: true })
    .click();
  const activity = page.getByRole("button", {
    name: /Alex Example posted in Dinner plans/,
  });
  await expect(activity).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("space-post-notification.png"),
    caret: "initial",
  });
  await activity.click();
  await expect(page).toHaveURL(
    /\/app\/spaces\/our-space\?post=shared-post#shared-post$/,
  );
  await expect(
    page.getByRole("heading", {
      name: "Account access is unavailable.",
      exact: true,
    }),
  ).toBeVisible();
});
