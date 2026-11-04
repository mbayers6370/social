import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture, friend } from "./helpers/member-fixture";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Fictional local member fixtures",
  );
  await memberFixture(page);
});

test("keeps the invitation card compact and borderless inside, with a usable Join action on phones", async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  await page.route(
    "**/__member_fixture/api/space-invitations/fictional-invitation/accept",
    (route) => route.fulfill({ json: { id: "saturday-dinner" } }),
  );
  await page.goto("/preview/auth?view=member&area=space-invitations");
  const card = page.getByRole("region", { name: "Space invitations" });
  const row = card.getByRole("listitem");
  const join = card.getByRole("button", {
    name: "Join Saturday Dinner",
    exact: true,
  });
  await join.scrollIntoViewIfNeeded();
  await expect(row).toHaveCSS("border-bottom-width", "0px");
  await expect(
    card.getByRole("heading", { name: "Invitations" }),
  ).toBeVisible();
  await expect(join).toBeInViewport({ ratio: 1 });
  const copy = (await card
    .locator(".margin-space-invitation-copy")
    .boundingBox())!;
  const action = (await join.boundingBox())!;
  if (isMobile) {
    expect(action.y).toBeGreaterThanOrEqual(copy.y + copy.height + 12);
    expect(action.width).toBeCloseTo((await row.boundingBox())!.width, 0);
  } else {
    expect(action.x).toBeGreaterThan(copy.x);
    expect(
      Math.abs(action.y + action.height / 2 - (copy.y + copy.height / 2)),
    ).toBeLessThan(2);
  }
  await captureScreenshot(card, {
    path: info.outputPath("space-invitation-card.png"),
    caret: "initial",
  });
  await join.click();
  await expect(page).toHaveURL(/\/app\/spaces\/saturday-dinner$/);
  // The rendering fixture has no Clerk session. Navigation must reach the
  // protected destination; the real-PostgreSQL test proves joined access.
  await expect(
    page.getByRole("heading", {
      name: "Account access is unavailable.",
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.pageErrors()).toEqual([]);
});

test("announces an unread Space invitation in Notifications, keeps a failed Join recoverable, and navigates to the protected Space after joining", async ({
  page,
}, info) => {
  let joined = false;
  let attempts = 0;
  await page.route("**/__member_fixture/api/notifications", (route) =>
    route.fulfill({
      json: {
        activity: joined
          ? []
          : [
              {
                id: "invitation-notification",
                actor: friend,
                kind: "space_invitation",
                invitation: {
                  id: "fictional-invitation",
                  space: { name: "Saturday Dinner" },
                },
                href: "/app/spaces#space-invitations",
                createdAt: "2026-10-28T18:00:00Z",
                read: false,
              },
            ],
        nextCursor: null,
      },
    }),
  );
  await page.route(
    "**/__member_fixture/api/space-invitations/fictional-invitation/accept",
    (route) => {
      if (++attempts === 1)
        return route.fulfill({
          status: 503,
          json: { error: "Couldn’t join right now. Please try again." },
        });
      joined = true;
      return route.fulfill({ json: { id: "saturday-dinner" } });
    },
  );
  await page.goto("/preview/auth?view=member&area=spaces");
  await page
    .getByRole("button", { name: "Notifications, 1 unread", exact: true })
    .click();
  const panel = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(panel.getByText(/invited you to Saturday Dinner/)).toBeVisible();
  const join = panel.getByRole("button", {
    name: "Join Saturday Dinner",
    exact: true,
  });
  await expect(join).toBeInViewport({ ratio: 1 });
  const copy = (await panel
    .locator(".margin-notification-copy")
    .boundingBox())!;
  const action = (await join.boundingBox())!;
  const item = (await panel
    .locator(".margin-notification-item")
    .boundingBox())!;
  expect(action.x).toBeCloseTo(copy.x, 0);
  expect(
    item.y + item.height - action.y - action.height,
  ).toBeGreaterThanOrEqual(15);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "125%";
  });
  const largerCopy = (await panel
    .locator(".margin-notification-copy")
    .boundingBox())!;
  expect((await join.boundingBox())!.x).toBeCloseTo(largerCopy.x, 0);
  await expect(join).toBeInViewport({ ratio: 1 });
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await join.click();
  await expect(panel.getByRole("alert")).toHaveText(
    "Couldn’t join right now. Please try again.",
  );
  await expect(panel).toBeVisible();
  await expect(join).toBeEnabled();
  await captureScreenshot(page, {
    path: info.outputPath("space-invitation-notification.png"),
    caret: "initial",
  });
  await join.click();
  await expect(page).toHaveURL(/\/app\/spaces\/saturday-dinner$/);
  // The rendering fixture has no Clerk session. Navigation must reach the
  // protected destination; the real-PostgreSQL test proves joined access.
  await expect(
    page.getByRole("heading", {
      name: "Account access is unavailable.",
      exact: true,
    }),
  ).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.pageErrors()).toEqual([]);
});
