import { expect, test } from "./fixtures";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development social preview",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("desktop messages and footer fit without page scrolling, including a growing draft", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop page frame");
  await page.goto("/?view=messages&thread=ines");
  for (const height of [900, 700, 500]) {
    await page.setViewportSize({ width: 1280, height });
    const input = page.getByRole("textbox", {
      name: "Note to self",
    });
    await input.fill("A draft that wraps over several lines. ".repeat(10));
    await expect(input).toBeInViewport({ ratio: 1 });
    const footer = page.getByRole("navigation", {
      name: "Footer",
      exact: true,
    });
    await expect(footer).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollHeight - innerHeight,
        ),
      )
      .toBeLessThanOrEqual(1);
    const history = page.getByRole("region", { name: "Notebook history" });
    expect((await history.boundingBox())!.height).toBeGreaterThan(0);
    await history.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.mouse.move(1250, height - 10);
    await page.mouse.wheel(0, 1000);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  }
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("desktop-messages-footer.png"),
  });
});

test("a friend's profile has compact friendship and message controls and opens their own empty thread", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=profile&person=mara");
  const identity = page.locator(".margin-profile-identity");
  const friend = identity.getByRole("img", {
    name: "Friends with Mara Lindqvist",
  });
  const message = identity.getByRole("link", {
    name: "Message Mara Lindqvist",
    exact: true,
  });
  await expect(message).toHaveAttribute("href", "/?view=messages&thread=mara");
  for (const control of [friend, message])
    await expect(control).toHaveCSS("border-radius", "8px");
  await expect(friend.locator(".lucide-users")).toHaveCount(1);
  await expect(friend.locator(".lucide-check")).toHaveCount(0);
  await expect(message.locator(".lucide-mail")).toHaveCount(1);
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 700 });
    const avatar = (await identity
      .locator(".margin-profile-heading > .margin-avatar")
      .boundingBox())!;
    const name = (await identity
      .getByRole("heading", { level: 1 })
      .boundingBox())!;
    const bio = (await identity.locator(".margin-profile-bio").boundingBox())!;
    expect(name.x).toBeGreaterThan(avatar.x + avatar.width);
    expect(name.y).toBeLessThan(avatar.y + avatar.height);
    expect(bio.y).toBeGreaterThanOrEqual(avatar.y + avatar.height);
    expect((await message.boundingBox())!.y).toBeGreaterThan(
      bio.y + bio.height,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("link", { name: "Messages", exact: true })
        .locator(".lucide-mail"),
    ).toHaveCount(1);
  }
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("profile-contact-actions.png"),
  });
  await message.click();
  await expect(page).toHaveURL(/view=messages&thread=mara/);
  await expect(
    page
      .getByRole("region", {
        name: "Conversation with Mara Lindqvist",
        exact: true,
      })
      .getByRole("heading", { name: "Mara Lindqvist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No messages yet. Say hello to Mara."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message to Mara Lindqvist" })
    .fill("Loved your river photograph.");
  await page
    .getByRole("button", { name: "Add message to local preview" })
    .click();
  await expect(
    page.getByRole("list", { name: "Messages with Mara Lindqvist" }),
  ).toContainText("Loved your river photograph.");
});

test("blocking a friend hides private content and prevents new messages; unblocking does not restore friendship", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=profile&person=theo");
  await page
    .getByRole("button", { name: "More options for Theo Marchetti" })
    .click();
  await page
    .getByRole(testInfo.project.name === "mobile" ? "button" : "menuitem", {
      name: "Block profile",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", { name: "Block Theo Marchetti?" });
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await dialog.getByRole("button", { name: "Block", exact: true }).click();
  await expect(
    page
      .locator(".margin-profile-contact")
      .getByRole("link", { name: "Message Theo Marchetti", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".margin-profile-posts .margin-feed-post"),
  ).toHaveCount(0);
  await expect(page.locator(".margin-profile-gallery img")).toHaveCount(0);
  await page.getByRole("link", { name: "Messages", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Open conversation with Theo Marchetti",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Messaging is unavailable for this profile."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message to Theo Marchetti" }),
  ).toHaveCount(0);
  await page
    .locator(".margin-thread-header")
    .getByRole("link", { name: "View profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "More options for Theo Marchetti" })
    .click();
  await page
    .getByRole(testInfo.project.name === "mobile" ? "button" : "menuitem", {
      name: "Unblock profile",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Unblock", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add friend", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".margin-profile-posts .margin-feed-post"),
  ).toHaveCount(0);
});

test("nonfriends can be blocked and reported without sending a request or report", async ({
  page,
}, testInfo) => {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      !request.url().includes("_next")
    )
      mutations.push(request.url());
  });
  await page.goto("/?view=profile&person=nadia");
  await page
    .getByRole("button", { name: "More options for Nadia Haddad" })
    .click();
  await page
    .getByRole(testInfo.project.name === "mobile" ? "button" : "menuitem", {
      name: "Report profile",
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Reason", exact: true })
    .selectOption({ label: "Spam or scams" });
  await page
    .getByRole("textbox", { name: "Details (optional)" })
    .fill("An example for this preview.");
  await page
    .getByRole("button", { name: "Preview report", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Report preview", exact: true }),
  ).toContainText("Nothing has been sent or saved.");
  await page
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "More options for Nadia Haddad" })
    .click();
  await page
    .getByRole(testInfo.project.name === "mobile" ? "button" : "menuitem", {
      name: "Block profile",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await expect(
    page.getByText("Friend requests unavailable", { exact: true }),
  ).toBeVisible();
  expect(mutations).toEqual([]);
});
