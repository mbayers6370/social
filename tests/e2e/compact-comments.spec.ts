import { captureScreenshot, expect, test, type Page } from "./fixtures";
import { memberFixture, friend, identity } from "./helpers/member-fixture";

const roots = Array.from({ length: 5 }, (_, index) => ({
  id: `comment-${index}`,
  author: friend,
  body: `A small thought, number ${index + 1}.`,
  createdAt: "2026-11-02T19:00:00Z",
}));

async function openDiscussion(page: Page, nested = false) {
  await memberFixture(page);
  const comments = nested
    ? [
        roots[0],
        { ...roots[1], replyTo: roots[0].id },
        { ...roots[2], replyTo: roots[1].id },
      ]
    : roots;
  await page.route("**/__member_fixture/api/posts/*/comments", (route) =>
    route.fulfill({
      json: {
        comments,
        nextCursor: null,
        readOnly: false,
        viewer: identity.person,
        liked: false,
        likeCount: 1,
      },
    }),
  );
  await page.goto("/preview/auth?view=member&area=feed-posts");
  await page.getByRole("button", { name: /^Conversation on/ }).click();
  const dialog = page.getByRole("dialog", { name: /^Conversation on/ });
  await expect(dialog.locator(".margin-comment").first()).toBeVisible();
  await expect(page.locator("article").first()).toHaveAttribute(
    "data-phase",
    "open",
  );
  return dialog;
}

test.beforeEach(() =>
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixture"),
);

test("fits five short comments in the desktop panel with a plain like count", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop panel density");
  const dialog = await openDiscussion(page);
  await expect(dialog.locator(".margin-comment")).toHaveCount(5);
  const scroll = dialog.locator(".margin-conversation-scroll");
  await expect
    .poll(() =>
      scroll.evaluate((node) => node.scrollHeight - node.clientHeight),
    )
    .toBeLessThanOrEqual(1);
  await expect(dialog.locator("[data-like-count]")).toHaveText("1 like");
  await expect(dialog.locator("[data-like-count] svg")).toHaveCount(0);
});

test("keeps replies at one indent and aligns the thread control with the text", async ({
  page,
}, info) => {
  const dialog = await openDiscussion(page, true);
  const toggle = dialog.getByRole("button", { name: "Show 2 replies" });
  const text = dialog.locator(".margin-comment-main > p").first();
  expect((await toggle.boundingBox())!.x).toBeCloseTo(
    (await text.boundingBox())!.x,
    1,
  );
  await toggle.click();
  const replies = dialog.getByRole("list", { name: "Replies to Alex Example" });
  await expect(replies.locator(".margin-reply-context")).toHaveCount(1);
  await expect(replies.locator("ol")).toHaveCount(0);
  const rows = replies.locator(".margin-comment");
  expect((await rows.nth(0).boundingBox())!.x).toBeCloseTo(
    (await rows.nth(1).boundingBox())!.x,
    1,
  );
  await expect(dialog.locator("[data-like-count] svg")).toHaveCount(0);
  await captureScreenshot(page, {
    path: info.outputPath("compact-replies.png"),
  });
});
