import { expect, test, type Page } from "@playwright/test";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Screen fixtures are development-only",
  ),
);

function navigation(page: Page) {
  return page.getByRole("navigation", {
    name: page.viewportSize()!.width < 1024 ? "Mobile navigation" : "Primary",
    exact: true,
  });
}

test("text-size preferences scale content and portal fields and survive navigation", async ({
  page,
}) => {
  await page.goto("/?view=settings");
  const preview = page.getByRole("group", { name: "Text size preview" });
  for (const [label, size, meta] of [
    ["Standard", 16, 12],
    ["Larger", 20, 15],
    ["Extra large", 24, 18],
  ] as const) {
    await page.getByRole("radio", { name: label, exact: true }).check();
    await expect(preview.locator("p")).toHaveCSS("font-size", `${size}px`);
    await expect(preview.locator("span")).toHaveCSS("font-size", `${meta}px`);
    await page.getByRole("button", { name: "Search profiles" }).click();
    const dialog = page.getByRole("dialog", { name: "Find a Profile" });
    await expect(
      dialog.getByRole("searchbox", { name: "Name or username" }),
    ).toHaveCSS("font-size", `${size}px`);
    await page.keyboard.press("Escape");
  }
  await page
    .locator(".margin-settings-page")
    .getByRole("link", { name: "Profile", exact: true })
    .click();
  await expect(page.locator(".margin-profile-bio")).toHaveCSS(
    "font-size",
    "24px",
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-size",
    "extra-large",
  );
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("radio", { name: "Standard", exact: true }).check();
  await expect(preview.locator("p")).toHaveCSS("font-size", "16px");
});

test("navigation opens Messages and Profile with the correct current page", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await navigation(page)
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await expect(
    navigation(page).getByRole("link", { name: "Messages", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.screenshot({ path: testInfo.outputPath("messages.png") });
  const mobile = page.viewportSize()!.width < 1024;
  if (mobile)
    await navigation(page)
      .getByRole("link", { name: "Profile", exact: true })
      .click();
  else {
    await page.getByRole("button", { name: "Profile menu" }).click();
    await page.getByRole("link", { name: "View profile" }).click();
  }
  await expect(
    page.getByRole("heading", { level: 1, name: "Ines Alvarez" }),
  ).toBeVisible();
  if (mobile)
    await expect(
      navigation(page).getByRole("link", { name: "Profile", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  else
    await expect(
      page.getByRole("button", { name: "Profile menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("heading", { name: "Gallery", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("profile.png"),
    fullPage: true,
  });
  await navigation(page)
    .getByRole("link", { name: "Feed", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Feed" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("opens sample threads, validates and escapes local messages without sending requests", async ({
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
  await page.goto("/?view=messages");
  await page.getByRole("button", { name: /June Park/ }).click();
  const thread = page.getByRole("region", {
    name: "Conversation with June Park",
    exact: true,
  });
  await expect(
    thread.getByRole("heading", { name: "June Park" }),
  ).toBeVisible();
  await thread
    .getByRole("button", { name: "Add message to local preview" })
    .click();
  await expect(thread.getByRole("alert")).toHaveText("Write a message first.");
  const input = thread.getByRole("textbox", { name: "Message to June Park" });
  await expect(input).toBeFocused();
  await input.fill("<script>window.compromised=true</script> Thank you, June!");
  await thread
    .getByRole("button", { name: "Add message to local preview" })
    .click();
  await expect(thread.getByRole("status")).toContainText("Nothing was sent");
  await expect(
    thread.locator(".margin-message-bubble").filter({
      hasText: "<script>window.compromised=true</script> Thank you, June!",
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => "compromised" in window)).toBe(false);
  expect(mutations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("message-thread.png") });
  if (page.viewportSize()!.width < 1024) {
    await thread.getByRole("button", { name: "Back to messages" }).click();
    await expect(page.getByRole("button", { name: /June Park/ })).toBeFocused();
  } else {
    const exportButton = thread.getByRole("button", {
      name: "Export conversation",
    });
    await exportButton.click();
    await expect(
      page.getByRole("dialog", { name: "Conversation export" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(exportButton).toBeFocused();
  }
  await page.getByRole("button", { name: /Ines Alvarez/ }).click();
  await expect(
    page.getByRole("heading", { name: "Ines Alvarez", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Thank you, June!", { exact: false }),
  ).toHaveCount(0);
});

test("preserves separate message drafts between sample threads and supports browser Back", async ({
  page,
}) => {
  await page.goto("/?view=messages");
  await page.getByRole("button", { name: /Ines Alvarez/ }).click();
  await page
    .getByRole("textbox", { name: "Message to Ines Alvarez" })
    .fill("Bring a thermos");
  if (page.viewportSize()!.width < 1024)
    await page.getByRole("button", { name: "Back to messages" }).click();
  await page.getByRole("button", { name: /Theo Marchetti/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Message to Theo Marchetti" }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Message to Theo Marchetti" })
    .fill("Which book next?");
  if (page.viewportSize()!.width < 1024)
    await page.getByRole("button", { name: "Back to messages" }).click();
  await page.getByRole("button", { name: /Ines Alvarez/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Message to Ines Alvarez" }),
  ).toHaveValue("Bring a thermos");
  await page.goBack();
  await expect(page).not.toHaveURL(/thread=ines/);
});

test("profile editing validates input, contains keyboard focus and updates only the preview", async ({
  page,
}) => {
  await page.goto("/?view=profile");
  const menu = page.getByRole("button", { name: "Profile menu" });
  await menu.click();
  const trigger = page.getByRole("button", {
    name: "Edit profile",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Edit profile",
    exact: true,
  });
  await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("");
  await dialog.getByRole("button", { name: "Save preview" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter a name.");
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Ines, locally");
  await dialog
    .getByRole("textbox", { name: "Bio", exact: true })
    .fill("Walking slowly. Looking closely.");
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "Save preview" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ines, locally",
  );
  await expect(
    page.getByText("Walking slowly. Looking closely.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ines Alvarez",
  );
});

test("uses all supplied photos through Next image optimization", async ({
  page,
  request,
}) => {
  await page.goto("/");
  for (const id of ["post-fog", "post-porch", "post-tea"]) {
    await page.goto(id === "post-fog" ? "/?view=profile" : "/");
    const images = page.locator(`#${id} .margin-post-image`);
    const multiple = (await images.count()) > 1;
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      const source = await image.evaluate(
        (node) => (node as HTMLImageElement).currentSrc,
      );
      expect(source).toContain("/_next/image?");
      expect((await request.get(source)).status()).toBe(200);
      expect(await image.getAttribute("alt")).toBeTruthy();
      await expect(image).toHaveCSS(
        "object-fit",
        multiple ? "cover" : "contain",
      );
      await expect(image).toHaveCSS("border-radius", "12px");
      const bounds = (await image.boundingBox())!;
      const post = (await page.locator(`#${id}`).boundingBox())!;
      expect(bounds.width).toBeLessThan(post.width);
      expect(bounds.height).toBeLessThanOrEqual(
        Math.min(480, page.viewportSize()!.height * 0.6) + 1,
      );
      if (multiple)
        expect(
          Number(new URL(source).searchParams.get("w")),
        ).toBeLessThanOrEqual(640);
    }
  }
  await page.goto("/?view=profile");
  const authorPhoto = page.locator("#post-fog .margin-avatar-image");
  await expect(authorPhoto).toHaveAttribute("src", /Ines_Coffee\./);
  await page.goto("/?view=profile");
  const avatar = page.locator(".margin-profile-identity .margin-avatar-image");
  await expect(avatar).toHaveAttribute("src", /Ines_Coffee\./);
  await expect
    .poll(() =>
      avatar.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const gallery = page.locator(".margin-gallery-preview img");
  await expect(gallery).toHaveCount(3);
  for (const [index, name] of [
    "morning_beach",
    "architecture_Mexico",
    "Ines_Coffee",
  ].entries()) {
    const image = gallery.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveAttribute("src", new RegExp(`${name}\\.`));
    await expect
      .poll(() =>
        image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(
      (await request.get((await image.getAttribute("src"))!)).status(),
    ).toBe(200);
  }
  await expect(
    page.locator("#post-profile-beach .margin-post-image"),
  ).toHaveAttribute("src", /morning_beach\./);
  await expect(
    page.locator("#post-profile-architecture .margin-post-image"),
  ).toHaveAttribute("src", /architecture_Mexico\./);
});

test("screens fit a 320px viewport and a mobile thread keeps its composer accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?view=profile");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navigation(page)
    .getByRole("link", { name: "Messages", exact: true })
    .click();
  await page.getByRole("button", { name: /Ines Alvarez/ }).click();
  await expect(
    page.getByRole("button", { name: "Back to messages" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message to Ines Alvarez" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
