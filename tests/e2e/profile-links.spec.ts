import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local profiles only");
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("messages and profile hard loads hydrate cleanly during screenshots", async ({
  page,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/hydrat|server rendered HTML|didn't match/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  page.on("pageerror", (error) => hydrationErrors.push(error.message));

  for (const [index, url] of [
    "/?view=messages",
    "/?view=profile&person=samuel",
    "/?view=messages&thread=theo",
  ].entries()) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.screenshot({
      caret: "initial",
      path: testInfo.outputPath(`hydration-${index}.png`),
    });
    // Exercise a React event handler to establish that hydration has completed.
    const back = page.getByRole("button", { name: "Back to messages" });
    if (await back.isVisible()) {
      await back.click();
      await expect(
        page.getByRole("heading", { name: "Messages", exact: true }),
      ).toBeVisible();
    } else {
      await page
        .locator(".margin-header")
        .getByRole("button", { name: "Search profiles" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Find a Profile" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
    const messageInput = page.locator("#message-body");
    if (await messageInput.count())
      expect(
        await messageInput.evaluate((input) => input.style.caretColor),
      ).toBe("");
  }
  expect(hydrationErrors).toEqual([]);
});

test("post names and portraits open the matching profile, with its own posts and gallery", async ({
  page,
}) => {
  await page.goto("/");
  const author = page
    .locator(".margin-post-author")
    .filter({ hasText: "Samuel Okafor" })
    .first();
  await expect(
    author.getByRole("link", { name: "Samuel Okafor", exact: true }),
  ).toHaveAttribute("href", "/?view=profile&person=samuel");
  await author
    .getByRole("link", { name: "View Samuel Okafor’s profile" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Samuel Okafor" }),
  ).toBeVisible();
  await expect(page.locator(".margin-profile-handle")).toHaveText("@samuel");
  await expect(page.locator(".margin-profile-bio")).toContainText(
    "Weekend walks",
  );
  expect(
    new Set(
      await page
        .locator(".margin-profile-posts .margin-person-name")
        .allTextContents(),
    ),
  ).toEqual(new Set(["Samuel Okafor"]));
  await expect(page.locator(".margin-profile-gallery img")).not.toHaveCount(0);
  await expect(page.locator(".margin-profile-actions")).toHaveCount(0);
  await page.goBack();
  await page
    .locator(".margin-post-author")
    .getByRole("link", { name: "Theo Marchetti", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Theo Marchetti" }),
  ).toBeVisible();
  await expect(page.locator(".margin-profile-bio")).toContainText(
    "reading on the train",
  );
  expect(
    new Set(
      await page
        .locator(".margin-profile-posts .margin-person-name")
        .allTextContents(),
    ),
  ).toEqual(new Set(["Theo Marchetti"]));
});

test("comment identities navigate out of a conversation and Back returns to a usable feed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#post-samuel-beach")
    .getByRole("button", { name: "Conversation on Samuel Okafor’s post" })
    .click();
  const dialog = page.getByRole("dialog", { name: /Conversation/ });
  await expect(dialog).toBeVisible();
  const comment = dialog
    .locator(".margin-comment")
    .filter({ hasText: "June Park" })
    .first();
  await expect(
    comment.getByRole("link", { name: "June Park", exact: true }),
  ).toHaveAttribute("href", "/?view=profile&person=june");
  await comment.getByRole("link", { name: "View June Park’s profile" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "June Park" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .locator("#post-samuel-beach")
    .getByRole("button", { name: "Conversation on Samuel Okafor’s post" })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Conversation/ }),
  ).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "Add a comment" })
    .fill("A good day for a walk.");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await dialog.getByRole("link", { name: "You", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ines Alvarez" }),
  ).toBeVisible();
});

test("all seven mock people keep their own identity when navigating between profiles", async ({
  page,
}) => {
  await page.goto("/");
  const bios = new Set<string>();
  for (const [id, name] of [
    ["ines", "Ines Alvarez"],
    ["theo", "Theo Marchetti"],
    ["june", "June Park"],
    ["samuel", "Samuel Okafor"],
    ["mara", "Mara Lindqvist"],
    ["nadia", "Nadia Haddad"],
    ["owen", "Owen Price"],
  ]) {
    await page
      .locator(".margin-header")
      .getByRole("button", { name: "Search profiles" })
      .click();
    const search = page.getByRole("dialog", { name: "Find a Profile" });
    await search
      .getByRole("searchbox", { name: "Name or username" })
      .fill(name);
    await search.getByRole("link", { name: new RegExp(`^${name}`) }).click();
    await expect(
      page.getByRole("heading", { level: 1, name, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".margin-profile-handle")).toHaveText(`@${id}`);
    bios.add(await page.locator(".margin-profile-bio").innerText());
  }
  expect(bios.size).toBe(7);
});

test("message identities open the contact's profile while the message preview opens the thread", async ({
  page,
}) => {
  await page.goto("/?view=messages");
  const inbox = page.locator(".margin-inbox");
  await expect(inbox.locator("button a, a button")).toHaveCount(0);
  await inbox.getByRole("link", { name: "June Park", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "June Park" }),
  ).toBeVisible();
  await page.goBack();
  await page
    .getByRole("button", { name: "Open conversation with Theo Marchetti" })
    .click();
  const header = page.locator(".margin-thread-header");
  await expect(
    header.getByRole("link", { name: "View profile", exact: true }),
  ).toHaveAttribute("href", "/?view=profile&person=theo");
  await header
    .getByRole("link", { name: "View Theo Marchetti’s profile" })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Theo Marchetti" }),
  ).toBeVisible();
});

test("notification identities open their own profile without nesting links inside a button", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator(".margin-header")
    .getByRole("button", { name: /^Notifications,/ })
    .click();
  const panel = page.locator(".margin-notifications-panel");
  await expect(panel.locator("button a, a button")).toHaveCount(0);
  const actor = panel.getByRole("link", {
    name: "View Nadia Haddad’s profile",
  });
  await actor.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nadia Haddad" }),
  ).toBeVisible();
  await expect(page.locator(".margin-profile-handle")).toHaveText("@nadia");
  await expect(page.locator(".margin-profile-bio")).toContainText("next trail");
  await expect(page.locator(".margin-profile-posts")).toContainText(
    "Posts are shared with friends.",
  );
  await expect(panel).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test("the feed ending reveals once in view and immediately respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const ending = page.locator(".margin-feed-end");
  await expect(ending).not.toHaveAttribute("data-reveal", "active");
  await ending.scrollIntoViewIfNeeded();
  await expect(ending).toHaveAttribute("data-reveal", "active");
  await expect(ending.locator(".margin-feed-end-word")).toHaveCount(4);
  const names = await ending
    .locator(".margin-feed-end-word")
    .evaluateAll((words) =>
      words.map((word) => getComputedStyle(word).animationName),
    );
  expect(names).toEqual(Array(4).fill("margin-feed-ending-text"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(ending.locator(".margin-feed-end-word").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(ending.locator(".margin-feed-end-word").first()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    document.documentElement.dataset.motion = "reduced";
  });
  await expect(ending.locator(".margin-feed-end-word").first()).toHaveCSS(
    "animation-name",
    "none",
  );
});
