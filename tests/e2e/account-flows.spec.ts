import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { captureScreenshot, expect, test } from "./fixtures";
test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development account flows",
  ),
);
test("sets up a new profile with an empty feed and invitation", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByLabel("Your name", { exact: true }).fill("Alex River");
  await page.getByLabel("Username", { exact: true }).fill("alexriver");
  await page.getByRole("checkbox", { name: "I am 18 or older." }).check();
  await page.getByRole("button", { name: "Start your space" }).click();
  await expect(
    page.getByRole("heading", { name: "It starts with your people." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Invite someone", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your three invitations become available when you finish joining",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await captureScreenshot(page, {
    path: `test-results/account-invitation-${test.info().project.name}.png`,
  });
});
test("changes a profile photograph and offers selected account downloads", async ({
  page,
}) => {
  await page.goto("/?view=profile");
  await expect(
    page.getByRole("button", { name: "Change profile photograph" }),
  ).toHaveCount(0);
  await page
    .locator(".margin-profile-identity")
    .getByRole("button", { name: /^More options for/ })
    .click();
  await page.getByRole("button", { name: "Edit profile", exact: true }).click();
  const overlay = page.getByRole("button", {
    name: "Change profile photograph",
  });
  const portrait = page.locator(".margin-profile-portrait > .margin-avatar");
  const portraitBox = (await portrait.boundingBox())!;
  const overlayBox = (await overlay.boundingBox())!;
  for (const key of ["x", "y", "width", "height"] as const)
    expect(Math.abs(portraitBox[key] - overlayBox[key])).toBeLessThan(0.5);
  await captureScreenshot(page, {
    path: `test-results/profile-edit-${test.info().project.name}.png`,
  });
  await overlay.click();
  const picker = page.getByRole("dialog", { name: "Choose a photograph" });
  const selected = picker.getByRole("button", { name: /^Select / }).first();
  await expect(
    picker.getByRole("button", { name: "Use photograph", exact: true }),
  ).toBeDisabled();
  await selected.click();
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect(selected.locator(".margin-photo-selected-mark")).toBeVisible();
  await expect(selected).toHaveCSS("border-top-width", "3px");
  await expect(picker.getByRole("textbox")).toHaveCount(0);
  await picker
    .getByRole("button", { name: "Use photograph", exact: true })
    .click();
  const confirm = page.getByRole("dialog", { name: "Your Profile Photograph" });
  await expect(confirm.locator("img").first()).toBeVisible();
  await captureScreenshot(page, {
    path: `test-results/profile-photo-${test.info().project.name}.png`,
  });
  await confirm.getByRole("button", { name: "Use photograph" }).click();
  await expect(confirm).toHaveCount(0);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .locator(".margin-profile-identity")
    .getByRole("button", { name: /^More options for/ })
    .click();
  // Keep client navigation so the same tab account state is available.
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Download your data" }).click();
  const download = page.getByRole("dialog", {
    name: "Take your account with you",
  });
  await download.getByRole("button", { name: "Clear all" }).click();
  await download.getByRole("checkbox", { name: /Profile & music/ }).check();
  await download.getByRole("radio", { name: "JSON records only" }).check();
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    download.getByRole("button", { name: "Download", exact: true }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/\.json$/);
  const path = `test-results/account-${test.info().project.name}.json`;
  await file.saveAs(path);
  expect(Object.keys(JSON.parse(await readFile(path, "utf8")).data)).toEqual([
    "profile",
  ]);
  await page.getByRole("button", { name: "Download your data" }).click();
  await download
    .getByRole("checkbox", { name: /Photographs & gallery/ })
    .check();
  await download
    .getByRole("radio", { name: "Complete archive (.zip)", exact: true })
    .check();
  await captureScreenshot(page, {
    path: `test-results/account-download-${test.info().project.name}.png`,
  });
  const [bundle] = await Promise.all([
    page.waitForEvent("download"),
    download.getByRole("button", { name: "Download", exact: true }).click(),
  ]);
  const archivePath = `test-results/account-${test.info().project.name}.zip`;
  await bundle.saveAs(archivePath);
  const entries = unzipSync(new Uint8Array(await readFile(archivePath)));
  expect(strFromU8(entries["Your Margin account.pdf"].slice(0, 4))).toBe(
    "%PDF",
  );
  const records = JSON.parse(strFromU8(entries["account-data.json"]));
  expect(records.data.originalFiles.length).toBeGreaterThan(0);
  for (const file of records.data.originalFiles)
    expect(entries[file.name].length).toBeGreaterThan(0);
});

test("keeps frequent settings visible and secondary records expandable", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=settings");
  await expect(
    page.getByRole("radio", { name: "Standard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Comments & replies/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download your data" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Larger", exact: true }).check();
  await expect(
    page.getByRole("radio", { name: "Larger", exact: true }),
  ).toBeChecked();
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  const blocked = page.locator("#safety-settings details").first();
  await expect(blocked).not.toHaveAttribute("open");
  await blocked.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(blocked).toContainText("No blocked people.");
  await blocked.locator("summary").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("heading", { name: "Settings", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureScreenshot(page, {
    path: `test-results/settings-revised-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("edits an older account-owned reply on a profile and leaves a deletion placeholder", async ({
  page,
}) => {
  await page.goto("/?view=profile");
  await page.locator("#post-fog [data-conversation-trigger]").click();
  const dialog = page.getByRole("dialog", { name: /Conversation on/ });
  // The profile conversation flips into place. Wait for its actual animation,
  // so a pointer click cannot land on the front face during the turn.
  await expect
    .poll(() =>
      dialog.evaluate((node) =>
        node
          .getAnimations()
          .every((animation) => animation.playState !== "running"),
      ),
    )
    .toBe(true);
  const thread = dialog.getByRole("listitem").filter({
    has: page.locator("#comment-post-fog-fog-3"),
  });
  const toggle = thread.getByRole("button", {
    name: "Show 1 reply",
    exact: true,
  });
  await toggle.click();
  await expect(
    thread.getByRole("button", { name: "Hide replies", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  const reply = page.locator("#comment-post-fog-fog-4");
  await expect(
    reply.getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#comment-post-fog-fog-3")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await reply.getByRole("button", { name: "Edit", exact: true }).click();
  await reply
    .getByRole("textbox", { name: "Edit your comment" })
    .fill("Yes, that’s the trail. An updated reply.");
  await reply.getByRole("button", { name: "Save changes" }).click();
  await expect(reply).toContainText("Edited");
  await captureScreenshot(page, {
    path: `test-results/comment-actions-${test.info().project.name}.png`,
  });
  const label = dialog.locator("label").filter({ hasText: "Add a comment" });
  await expect(label).toHaveClass(/sr-only/);
  await reply.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete your comment?" })
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await expect(reply).toContainText("Comment deleted.");
  await expect(
    dialog.getByText(
      "Is this the Chimney Rock trail? Thinking of going Saturday.",
    ),
  ).toBeVisible();
});
