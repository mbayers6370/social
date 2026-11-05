import { captureScreenshot, test, expect } from "./fixtures";
import path from "node:path";
import type { Page } from "@playwright/test";
async function showSpaceOptions(page: Page) {
  const details = page.locator(".margin-space-options");
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open)))
    await details.locator("summary").click();
}

test.beforeEach(() => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Local Spaces review only",
  );
});

test("opens Spaces without credentials and keeps canonical conversations in the normal main Feed", async ({
  page,
}, info) => {
  const privateRequests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /\/api\/(?:spaces|posts|photos|relationships)(?:\/|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      privateRequests.push(request.url());
  });
  await page.goto("/app/spaces");
  await expect(page).toHaveURL(/\/preview\/spaces$/);
  await expect(page.getByLabel("Local Spaces preview")).toHaveCount(0);
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await expect(
    page.getByRole("heading", { name: "Japan 2027", exact: true }),
  ).toBeVisible();
  await showSpaceOptions(page);
  await page
    .getByRole("checkbox", { name: "Include posts from this Space in my Feed" })
    .check();
  const first = page.getByRole("article").first();
  const canonicalId = await first.getAttribute("id");
  await first.getByRole("button", { name: /Conversation on/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Add a comment").fill("Let’s stay near the station.");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    dialog.getByText("Let’s stay near the station.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Ines Alvarez", exact: true }).first(),
  ).toHaveAttribute("href", /\/\?view=profile&person=ines/);
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    })
    .getByRole("link", { name: "Feed", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("group", { name: "Create a post" }),
  ).toBeVisible();
  await expect(page.locator('article[id^="post-"]').first()).toBeVisible();
  await expect(
    page
      .locator(`article[id="${canonicalId}"]`)
      .getByRole("link", { name: "Space: Japan 2027", exact: true }),
  ).toHaveAttribute("href", "/preview/spaces?space=japan-2027");
  expect(
    await page
      .locator(`article[id="${canonicalId}"] .margin-space-post-source svg`)
      .count(),
  ).toBe(1);
  await expect(page.locator(`article[id="${canonicalId}"]`)).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("spaces-main-feed.png"),
    fullPage: true,
  });
  await page
    .locator(`article[id="${canonicalId}"]`)
    .getByRole("button", { name: /Conversation on/ })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Let’s stay near the station.", { exact: true }),
  ).toBeVisible();
  await captureScreenshot(page, {
    path: info.outputPath("spaces-preview-conversation.png"),
  });
  await page
    .getByRole("dialog")
    .getByRole("button", {
      name: "Back to post",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator(`article[id="${canonicalId}"]`)
    .getByRole("link", { name: "Space: Japan 2027", exact: true })
    .click();
  await showSpaceOptions(page);
  await expect(
    page.getByRole("checkbox", {
      name: "Include posts from this Space in my Feed",
    }),
  ).toBeChecked();
  await showSpaceOptions(page);
  await page
    .getByRole("checkbox", { name: "Include posts from this Space in my Feed" })
    .uncheck();
  await expect(page.locator(`article[id="${canonicalId}"]`)).toBeVisible();
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    })
    .getByRole("link", { name: "Feed", exact: true })
    .click();
  await expect(page.locator(`article[id="${canonicalId}"]`)).toHaveCount(0);
  expect(privateRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("creates a sample Space with plans, posts and photographs locally, then archives read-only", async ({
  page,
}, info) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      privateRequests.push(request.url());
  });
  await page.goto("/preview/spaces");
  await page.getByRole("button", { name: "New Space" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add a date and time" }).click();
  await dialog.getByLabel("Space name").fill("Music with friends");
  await dialog.getByLabel("Date", { exact: true }).fill("2027-04-04");
  await dialog.getByLabel("Time", { exact: true }).fill("19:00");
  await dialog
    .getByRole("combobox", { name: "Time zone" })
    .fill("America/Los_Angeles");
  await dialog
    .getByRole("option", { name: "America / Los Angeles", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Music with friends", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Share a thought…" }).click();
  await page
    .getByLabel("Your post", { exact: true })
    .fill("Meet outside at six?");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Meet outside at six?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New photo post" }).click();
  await page
    .getByLabel("Or upload a new one", { exact: true })
    .setInputFiles(path.resolve("src/assets/fixtures/dog.jpg"));
  await page.getByRole("button", { name: "Use photograph" }).click();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Photograph", exact: true }),
  ).toBeVisible();
  await showSpaceOptions(page);
  await page
    .getByRole("button", { name: "Archive Space", exact: true })
    .click();
  const archive = page.getByRole("alertdialog");
  await archive
    .getByRole("button", { name: "Archive Space", exact: true })
    .click();
  await expect(
    page
      .getByRole("group", { name: "Your RSVP" })
      .getByRole("button", { name: "Going", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  await captureScreenshot(page, {
    path: info.outputPath("spaces-preview-archived.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await showSpaceOptions(page);
  await page
    .getByRole("checkbox", { name: "Include posts from this Space in my Feed" })
    .check();
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    })
    .getByRole("link", { name: "Feed", exact: true })
    .click();
  await expect(
    page.getByRole("article").filter({ hasText: "Meet outside at six?" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Photograph", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", {
      name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
      exact: true,
    })
    .getByRole("link", { name: "Spaces", exact: true })
    .click();
  await page.getByRole("link", { name: /Music with friends/ }).click();
  await expect(
    page.getByRole("article").filter({ hasText: "Meet outside at six?" }),
  ).toBeVisible();
  const photograph = page.getByRole("img", {
    name: "Photograph",
    exact: true,
  });
  await expect(photograph).toBeVisible();
  expect(await photograph.getAttribute("src")).toMatch(/^blob:/);
  await expect(
    page
      .getByRole("group", { name: "Your RSVP" })
      .getByRole("button", { name: "Going", exact: true }),
  ).toBeDisabled();
  expect(privateRequests).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("This sample Space is unavailable."),
  ).toBeVisible();
});

test("retains an unfinished conversation and lets a member cancel or confirm leaving a Space", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/preview/spaces?space=reading-room");
  const trigger = page.getByRole("button", { name: /Conversation on/ });
  await trigger.click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Add a comment" })
    .fill("A thought I want to finish later.");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("textbox", { name: "Add a comment" }),
  ).toHaveValue("A thought I want to finish later.");
  await dialog.getByRole("textbox", { name: "Add a comment" }).focus();
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    dialog.getByText("A thought I want to finish later.", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await expect(
    page.getByRole("dialog").getByRole("textbox", { name: "Add a comment" }),
  ).toHaveValue("");
  await page.keyboard.press("Escape");
  await page.getByText("Members", { exact: true }).click();
  const leave = page.getByRole("button", { name: "Leave Space", exact: true });
  await leave.click();
  let confirmation = page.getByRole("alertdialog", {
    name: "Leave The Reading Room?",
  });
  await expect(
    confirmation.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await captureScreenshot(page, {
    path: info.outputPath("leave-space-confirmation.png"),
    caret: "initial",
  });
  await confirmation
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(leave).toBeFocused();
  await leave.click();
  confirmation = page.getByRole("alertdialog");
  await confirmation
    .getByRole("button", { name: "Leave Space", exact: true })
    .click();
  await expect(page).toHaveURL("/preview/spaces");
  await expect(
    page.getByRole("link", { name: /The Reading Room/ }),
  ).toHaveCount(0);
});
