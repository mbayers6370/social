import { expect, test } from "./fixtures";

test.beforeEach(() => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local profile preview");
});

test("keeps profile details before posts on small screens and preserves the desktop columns", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=profile");
  const profile = page.locator(".margin-profile");
  const identity = profile.locator(".margin-profile-identity");
  const music = profile.getByRole("region", { name: "On Repeat", exact: true });
  const gallery = profile.getByRole("region", { name: "Gallery", exact: true });
  const posts = profile.getByRole("region", {
    name: "Recent Posts",
    exact: true,
  });
  await expect(music).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.setViewportSize({ width: 320, height: 700 });
    const musicBox = (await music.boundingBox())!;
    const galleryBox = (await gallery.boundingBox())!;
    const postsBox = (await posts.boundingBox())!;
    expect(galleryBox.y).toBeGreaterThanOrEqual(musicBox.y + musicBox.height);
    expect(postsBox.y).toBeGreaterThanOrEqual(galleryBox.y + galleryBox.height);
    const images = gallery.locator(".margin-gallery-preview img");
    await expect(images).toHaveCount(3);
    const boxes = await Promise.all(
      (await images.all()).map((image) => image.boundingBox()),
    );
    for (const box of boxes) {
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
      expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } else {
    const identityBox = (await identity.boundingBox())!;
    const postsBox = (await posts.boundingBox())!;
    expect(postsBox.x).toBeGreaterThanOrEqual(
      identityBox.x + identityBox.width,
    );
    expect(Math.abs(postsBox.y - identityBox.y)).toBeLessThan(1);
  }
  const controls = [
    identity.getByRole("button", { name: "New Post", exact: true }),
    identity.getByRole("button", { name: "Edit profile", exact: true }),
    identity.getByRole("link", { name: "Settings", exact: true }),
  ];
  const identityBox = (await identity.boundingBox())!;
  const boxes = await Promise.all(
    controls.map((control) => control.boundingBox()),
  );
  for (const [index, box] of boxes.entries()) {
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      identityBox.x + identityBox.width + 1,
    );
    expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
    if (index > 0) expect(box!.x).toBeGreaterThan(boxes[index - 1]!.x);
  }
});

test("keeps the named friendship status, envelope and options together at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?view=profile&person=mara");
  const identity = page.locator(".margin-profile-identity");
  const friends = identity.getByRole("img", {
    name: "Friends with Mara Lindqvist",
  });
  const message = identity.getByRole("link", {
    name: "Message Mara Lindqvist",
    exact: true,
  });
  const options = identity.getByRole("button", {
    name: "More options for Mara Lindqvist",
  });
  await expect(friends).toHaveText("Friends");
  const boxes = await Promise.all(
    [friends, message, options].map((control) => control.boundingBox()),
  );
  for (const box of boxes) {
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(box!.y - boxes[0]!.y)).toBeLessThan(1);
  }
  expect(boxes[1]!.x - boxes[0]!.x - boxes[0]!.width).toBeLessThanOrEqual(12);
  expect(boxes[2]!.x - boxes[1]!.x - boxes[1]!.width).toBeLessThanOrEqual(12);
  await expect(message).toHaveAttribute("href", "/?view=messages&thread=mara");
});

test("keeps pending-request profile cards private and gives Decline a visible border", async ({
  page,
}) => {
  await page.goto("/?view=profile&person=nadia");
  const decline = page.getByRole("button", { name: "Decline", exact: true });
  await expect(decline).toBeVisible();
  expect(
    await decline.evaluate((button) =>
      Number.parseFloat(getComputedStyle(button).borderTopWidth),
    ),
  ).toBeGreaterThan(0);
  const profile = page.locator(".margin-profile");
  for (const [name, copy] of [
    ["On Repeat", "Songs are shared with friends."],
    ["Gallery", "Photos are shared with friends."],
    ["Recent Posts", "Posts are shared with friends."],
  ]) {
    const card = profile.getByRole("region", { name, exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByText(copy, { exact: true })).toBeVisible();
    await expect(card.locator("img")).toHaveCount(0);
    await expect(card.getByRole("link")).toHaveCount(0);
  }
  await decline.click();
  await expect(
    page.getByRole("button", { name: "Add friend", exact: true }),
  ).toBeVisible();
  await expect(
    profile.getByText("Songs are shared with friends.", { exact: true }),
  ).toBeVisible();
});

test("Nadia's scientist profile stays private until acceptance, then loads real fixture photos and posts", async ({
  page,
}) => {
  await page.goto("/?view=profile&person=nadia");
  const profile = page.locator(".margin-profile");
  await expect(profile.locator(".margin-profile-bio")).toContainText(
    "Scientist",
  );
  await expect(profile.locator(".margin-profile-heading img")).toHaveCount(1);
  await expect(
    profile.getByText("Songs are shared with friends.", { exact: true }),
  ).toBeVisible();
  await expect(profile.locator(".margin-profile-gallery img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click();
  await expect(
    profile.getByRole("img", { name: "Friends with Nadia Haddad" }),
  ).toBeVisible();
  await expect(
    profile.getByRole("button", {
      name: "Open Teardrop by Massive Attack",
      exact: true,
    }),
  ).toBeVisible();
  await expect(profile.locator(".margin-profile-gallery img")).toHaveCount(3);
  await expect(
    profile.locator(".margin-profile-posts .margin-feed-post"),
  ).toHaveCount(3);
  await profile.getByRole("link", { name: "View More", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Nadia Haddad’s Gallery" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Feed", exact: true }).click();
  await expect(page.locator("#post-nadia-lab")).toBeVisible();
  // Initially rendered and newly loaded posts share the same plain author treatment.
  for (const id of ["post-nadia-lab", "post-book", "post-porch"]) {
    const author = page.locator(`#${id} .margin-post-author`);
    await expect(author).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(author.getByRole("heading")).toBeVisible();
    await expect(
      author.getByRole("button", { name: /^Conversation on/ }),
    ).toBeVisible();
  }
});
