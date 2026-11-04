import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development preview");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("exports beside the expiry rule and restores focus after conversation dialogs", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=messages&thread=june");
  await expect(
    page.locator('button[aria-label="Search profiles"]'),
  ).toBeEnabled();
  const header = page.locator(".margin-thread-header");
  const options = header.getByRole("button", { name: "Conversation options" });
  const download = page
    .locator(".margin-message-retention")
    .getByRole("button", {
      name: "Export conversation",
    });
  const report = header.getByRole("button", { name: "Report conversation" });
  await expect(download).toBeVisible();
  await expect(report).toBeHidden();
  if (testInfo.project.name === "mobile")
    await expect(
      header.getByRole("button", { name: "Back to messages" }),
    ).toBeFocused();
  await options.focus();
  await page.keyboard.press("ArrowDown");
  await expect(report).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await expect(options).toHaveAttribute("aria-expanded", "false");

  await options.click();
  await page.screenshot({
    path: testInfo.outputPath("conversation-options.png"),
    caret: "initial",
  });
  await download.click();
  const exportDialog = page.getByRole("dialog", {
    name: "Download this conversation",
  });
  await expect(exportDialog).toBeVisible();
  await expect(
    exportDialog.getByRole("checkbox", { name: /^Messages / }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(download).toBeFocused();
  await expect(options).toHaveAttribute("aria-expanded", "false");

  await options.click();
  await report.click();
  const reportDialog = page.getByRole("dialog", {
    name: "Report message",
    exact: true,
  });
  await expect(reportDialog).toContainText("Conversation with June Park");
  await reportDialog.getByLabel("Reason").selectOption("spam");
  await reportDialog.getByRole("button", { name: "Save report" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(options).toBeFocused();
  await options.click();
  await header.getByRole("heading", { name: "June Park" }).click();
  await expect(options).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("feed cards keep utility actions in the header and Conversation in a compact, balanced footer", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.locator('button[aria-label="Search profiles"]'),
  ).toBeEnabled();
  const card = page.locator("#post-book");
  const options = card.getByRole("button", { name: /Post options for/ });
  const conversation = card.getByRole("button", { name: /Conversation on/ });
  await expect(options).toBeVisible();
  await expect(card.locator(".margin-post-author")).toContainText(
    "Theo Marchetti",
  );
  await expect(
    card
      .locator(".margin-post-footer")
      .getByRole("button", { name: /Conversation on/ }),
  ).toBeVisible();
  const geometry = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    const menu = node
      .querySelector(".margin-post-options > button")!
      .getBoundingClientRect();
    const conversation = node
      .querySelector("[data-conversation-trigger]")!
      .getBoundingClientRect();
    return {
      top: style.paddingTop,
      bottom: style.paddingBottom,
      menuHeight: menu.height,
      conversationHeight: conversation.height,
    };
  });
  expect(geometry.top).toBe("16px");
  expect(geometry.bottom).toBe("16px");
  expect(geometry.menuHeight).toBeGreaterThanOrEqual(44);
  expect(geometry.conversationHeight).toBeGreaterThanOrEqual(44);
  await options.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    card.getByRole("menuitem", { name: "View profile" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  const report = card.getByRole("menuitem", {
    name: "Report post",
    exact: true,
  });
  await expect(report).toBeFocused();
  await expect(report.locator("svg")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("feed-card-menu.png"),
    caret: "initial",
  });
  await report.click();
  await expect(
    page.getByRole("dialog", { name: "Report post", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await conversation.click();
  await expect(
    page.getByRole("dialog", { name: /Conversation/ }),
  ).toBeVisible();
  await expect(card).toHaveAttribute("data-phase", "open");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Conversation/ })).toHaveCount(
    0,
  );
  await expect(card).toHaveAttribute("data-selected", "false");
  await expect(conversation).toBeFocused();
});

test("closing a conversation tolerates a detached original trigger", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const trigger = page.locator("#post-book [data-conversation-trigger]");
  await trigger.click();
  await expect(page.locator("#post-book")).toHaveAttribute(
    "data-phase",
    "open",
  );
  // Fault injection: the source control disappears while its dialog is open.
  await trigger.evaluate((node) => node.remove());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /Conversation/ })).toHaveCount(
    0,
  );
  await expect(page.locator("#feed-title")).toBeFocused();
  expect(errors).toEqual([]);
});

test("Space cards show their audience, support reporting, and opt out without leaving membership", async ({
  page,
}, info) => {
  await page.goto("/preview/spaces?space=japan-2027");
  await page.locator(".margin-space-options > summary").click();
  await page
    .getByRole("checkbox", { name: "Include posts from this Space in my Feed" })
    .check();
  const navigation = () =>
    page.getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    });
  await navigation().getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("#post-book")).toBeVisible();
  const card = page.locator('[data-space-post="true"]').first();
  await expect(
    card
      .locator(".margin-post-author")
      .getByRole("link", { name: "Space: Japan 2027" }),
  ).toBeVisible();
  await expect(
    card
      .locator(".margin-post-footer")
      .getByRole("button", { name: /Conversation on/ }),
  ).toBeVisible();
  const options = card.getByRole("button", { name: /Post options for/ });
  await options.click();
  await card
    .getByRole("menuitem", { name: "Report post", exact: true })
    .click();
  await page.getByRole("combobox", { name: "Reason" }).selectOption("spam");
  await page.getByRole("button", { name: "Save report", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Report saved", exact: true }),
  ).toContainText("Live moderation is not connected");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(options).toBeFocused();
  await options.click();
  await page.screenshot({
    path: info.outputPath("space-card-menu.png"),
    caret: "initial",
  });
  await card
    .getByRole("menuitem", { name: "Remove Space from my Feed", exact: true })
    .click();
  await expect(page.locator('[data-space-post="true"]')).toHaveCount(0);
  await expect(page.locator("#post-book")).toBeVisible();
  await navigation().getByRole("link", { name: "Spaces", exact: true }).click();
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await page.locator(".margin-space-options > summary").click();
  await expect(
    page.getByRole("checkbox", {
      name: "Include posts from this Space in my Feed",
    }),
  ).not.toBeChecked();
});
