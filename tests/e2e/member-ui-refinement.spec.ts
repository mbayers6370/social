import { test, expect } from "./fixtures";
import { memberFixture, friend, identity } from "./helpers/member-fixture";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Fictional member rendering only",
  );
  await memberFixture(page);
});

test("highlights the displayed conversation from entry with the light green selection and olive border", async ({
  page,
  isMobile,
}, info) => {
  await page.goto("/preview/auth?view=member&area=messages");
  const notebook = page.locator('.margin-thread-choice[data-notebook="true"]');
  await expect(notebook).toHaveAttribute("data-active", "true");
  await expect(notebook).toHaveCSS(
    "background-color",
    isMobile ? "rgb(255, 255, 255)" : "rgba(185, 198, 90, 0.35)",
  );
  await expect(notebook).toHaveCSS(
    "border-top-color",
    isMobile ? "rgb(223, 227, 229)" : "rgb(138, 145, 110)",
  );
  await page
    .getByRole("button", { name: "Open conversation with Alex Example" })
    .click();
  await expect(page.locator(".margin-thread")).toHaveCSS(
    "border-top-color",
    "rgb(138, 145, 110)",
  );
  if (!isMobile) {
    await expect(
      page.locator('.margin-thread-choice[data-active="true"]'),
    ).toHaveCSS("background-color", "rgba(185, 198, 90, 0.35)");
    await expect(notebook).toHaveCSS("background-color", "rgb(255, 255, 255)");
  } else await page.getByRole("button", { name: "Back to messages" }).click();
  await page.getByRole("button", { name: "Open notebook" }).click();
  await expect(
    page
      .locator(".margin-thread-header")
      .getByRole("heading", { name: "Notebook" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conversation options", exact: true }),
  ).toHaveCount(0);
  if (!isMobile) {
    await expect(notebook).toHaveCSS(
      "background-color",
      "rgba(185, 198, 90, 0.35)",
    );
    await expect(notebook).toHaveCSS("border-top-color", "rgb(138, 145, 110)");
  }
  await page.screenshot({
    path: info.outputPath("notebook-selection.png"),
    caret: "initial",
  });
});

test("spaces profile options consistently and preserves report, block and friendship controls", async ({
  page,
  isMobile,
}, info) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/preview/auth?view=member&area=friend-profile");
  const trigger = page.getByRole("button", {
    name: "More options for Alex Example",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Profile options",
    exact: true,
  });
  const friends = dialog.getByRole("button", {
    name: "Manage friendship with Alex Example",
  });
  const report = dialog.getByRole("button", {
    name: "Report profile",
    exact: true,
  });
  const block = dialog.getByRole("button", {
    name: "Block Alex Example",
    exact: true,
  });
  for (const control of [friends, report, block])
    await expect(control).toBeInViewport({ ratio: 1 });
  const a = (await friends.boundingBox())!,
    b = (await report.boundingBox())!,
    c = (await block.boundingBox())!;
  expect(a.x).toBeCloseTo(b.x, 0);
  expect(a.width).toBeCloseTo(b.width, 0);
  expect(b.y - a.y - a.height).toBeGreaterThanOrEqual(11);
  expect(c.y - b.y - b.height).toBeGreaterThanOrEqual(11);
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width - 16,
  );
  await page.screenshot({
    path: info.outputPath("profile-options.png"),
    caret: "initial",
  });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

for (const kind of ["comment", "reply"] as const) {
  test(`opens a ${kind} notification, expands the correct thread and focuses its target`, async ({
    page,
    isMobile,
  }, info) => {
    const targetId = kind === "comment" ? "older-comment" : "older-reply";
    const destination = `/preview/auth?view=member&area=profile&post=fictional-post&comment=${targetId}`;
    await page.route("**/__member_fixture/api/notifications", (route) =>
      route.fulfill({
        json: {
          activity: [
            {
              id: `notice-${kind}`,
              actor: friend,
              kind,
              href: destination,
              createdAt: "2026-11-02T19:00:00Z",
              read: false,
            },
          ],
          nextCursor: null,
        },
      }),
    );
    await page.route(
      "**/__member_fixture/api/posts/fictional-post/comments?*",
      async (route) => {
        expect(new URL(route.request().url()).searchParams.get("comment")).toBe(
          targetId,
        );
        await new Promise((resolve) => setTimeout(resolve, 250));
        return route.fulfill({
          json: {
            comments: [
              {
                id: "older-comment",
                body: "The original older comment",
                author: friend,
                createdAt: "2026-11-02T18:10:00Z",
              },
              {
                id: "older-reply",
                body: "The exact older reply",
                replyTo: "older-comment",
                author: friend,
                createdAt: "2026-11-02T18:11:00Z",
              },
              ...Array.from({ length: 20 }, (_, i) => ({
                id: `recent-${i}`,
                body: `Newer thought ${i}`,
                author: identity.person,
                createdAt: "2026-11-02T19:00:00Z",
              })),
            ],
            nextCursor: "recent-cursor",
            readOnly: false,
            viewer: identity.person,
          },
        });
      },
    );
    await page.goto("/preview/auth?view=member&area=profile");
    await page
      .getByRole("button", { name: "Notifications, 1 unread", exact: true })
      .click();
    const panel = page.getByRole("dialog", {
      name: "Notifications",
      exact: true,
    });
    await panel
      .getByRole("button", {
        name:
          kind === "comment"
            ? /Alex Example commented on/
            : /Alex Example replied to/,
      })
      .click();
    const dialog = page.getByRole("dialog", { name: /Conversation on/ });
    await expect(dialog).toHaveAttribute(
      "data-layout",
      isMobile ? "flip" : "inline-flip",
    );
    await expect(page.locator("#fictional-post")).toHaveAttribute(
      "data-phase",
      "open",
    );
    const target = dialog.locator(`#comment-fictional-post-${targetId}`);
    await expect(target).toBeVisible();
    await expect(target).toBeInViewport();
    await expect(target).toBeFocused();
    if (kind === "reply")
      await expect(
        dialog.getByRole("button", { name: "Hide replies" }),
      ).toHaveAttribute("aria-expanded", "true");
    await page.screenshot({
      path: info.outputPath(`notification-${kind}.png`),
      caret: "initial",
    });
    await dialog
      .getByRole("button", { name: "Back to post", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-conversation-trigger]")).toBeFocused();
    await expect(page).not.toHaveURL(/comment=/);
    // A consumed link must remain usable when the same activity is opened again.
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await panel
      .getByRole("button", {
        name:
          kind === "comment"
            ? /Alex Example commented on/
            : /Alex Example replied to/,
      })
      .click();
    await expect(target).toBeVisible();
    await expect(target).toBeFocused();
  });
}
