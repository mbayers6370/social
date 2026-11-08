import { test as base, expect, type Page } from "@playwright/test";

const test = base.extend<{ network: string[] }>({
  network: [
    async ({ page, baseURL }, use) => {
      const failures: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          url.origin !== baseURL ||
          url.pathname.startsWith("/api/") ||
          !["GET", "HEAD"].includes(request.method())
        )
          failures.push(`${request.method()} ${request.url()}`);
      });
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(message.text());
      });
      page.on("response", (response) => {
        if (response.status() >= 400)
          failures.push(`${response.status()} ${response.url()}`);
      });
      await page.addInitScript(() => {
        window.addEventListener("margin:demo-network-denied", (event) => {
          throw Error((event as CustomEvent<string>).detail);
        });
      });
      await use(failures);
      expect(failures).toEqual([]);
    },
    { auto: true },
  ],
});

async function navigate(page: Page, name: string) {
  const nav =
    page.viewportSize()!.width < 1024
      ? page.getByRole("navigation", { name: "Mobile navigation" })
      : page.getByRole("navigation", { name: "Primary", exact: true });
  await nav.getByRole("link", { name, exact: true }).click();
}
async function menu(page: Page, name: string) {
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Profile menu", exact: true })
    .getByRole("link", { name, exact: true })
    .click();
}

test("enters anonymously, navigates the actual exported pages and keeps layouts within the viewport", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A feed that ends. Imagine.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Interactive social concept/);
  await page.screenshot({ path: info.outputPath("demo-landing.png") });
  await page
    .getByRole("link", { name: "Explore Demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/demo\//);
  await expect(
    page.getByRole("complementary", { name: "Interactive demonstration" }),
  ).toContainText("Fictional accounts");
  await expect(page.locator("#post-book")).toContainText("Theo Marchetti");
  await expect(page.locator("#post-book")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: info.outputPath("demo-feed.png") });
  await navigate(page, "Messages");
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await navigate(page, "Spaces");
  await expect(
    page.getByRole("heading", { name: "Your spaces", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Japan 2027/ })).toBeVisible();
  await menu(page, "View profile");
  await expect(
    page.getByRole("heading", { name: "Ines Alvarez", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Back to Margin", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("opens sample photographs, edits profile and selects local music with bundled artwork", async ({
  page,
}, info) => {
  await page.goto("/demo/?view=profile");
  await expect(
    page
      .getByRole("region", { name: "On Repeat", exact: true })
      .locator("img")
      .first(),
  ).toHaveAttribute("src", /^\/_next\/static\/media\//);
  await expect(page.getByRole("link", { name: /iTunes/i })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Je veux by Greg Gontier", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Greg Gontier");
  await expect(
    page.getByRole("dialog").locator(".margin-song-details img"),
  ).toHaveAttribute("src", /greg-gontier-gregoire\.[a-z0-9]+\.jpg$/);
  await expect(page.getByRole("link", { name: /Spotify/ })).toHaveAttribute(
    "href",
    "https://open.spotify.com/track/5SKNuosJIUYtzmIj8nzQbu",
  );
  await page.screenshot({ path: info.outputPath("je-veux-on-repeat.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Find Music", exact: true }).click();
  await page.getByRole("searchbox", { name: "Song or artist" }).fill("Lovely");
  await page
    .getByRole("button", {
      name: "Add Lovely Day by Bill Withers",
      exact: true,
    })
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Open Lovely Day by Bill Withers",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Bill Withers");
  await expect(
    page.getByRole("link", { name: /Find on Spotify/ }),
  ).toHaveAttribute("href", /^https:\/\/open\.spotify\.com\/search\//);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Profile menu", exact: true })
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Ines Demo");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ines Demo", exact: true }),
  ).toBeVisible();
});

test("state is isolated between visitors and resets on refresh", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/demo/?view=profile");
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Profile menu", exact: true })
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Only this visitor");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await other.goto(`${baseURL}/demo/?view=profile`);
    await expect(
      other.getByRole("heading", { name: "Ines Alvarez", exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "Only this visitor", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ines Alvarez", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});

test("exports no backend, authentication, private profiles or administrative pages", async ({
  request,
}) => {
  for (const path of [
    "/api/member/context",
    "/api/posts",
    "/app/",
    "/app/moderation/",
    "/sign-in/",
    "/preview/spaces/",
    "/people/ines/",
    "/help/",
    "/privacy/",
    "/terms/",
    "/copyright/",
    "/contact/",
    "/cookies/",
    "/accessibility/",
    "/community-guidelines/",
  ]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  expect(
    (
      await request.post("/api/posts", { data: { body: "Must not send" } })
    ).status(),
  ).toBe(405);
  expect((await request.get("/")).status()).toBe(200);
  const demo = await request.get("/demo/");
  expect(demo.headers()["content-security-policy"]).toContain(
    "script-src 'self' 'sha256-",
  );
  expect(demo.headers()["x-robots-tag"]).toContain("noindex");
  const html = await demo.text();
  expect(html).toContain('name="robots" content="noindex, nofollow"');
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /demo/");
});

test("comments and reactions update locally and survive demo navigation", async ({
  page,
}) => {
  await page.goto("/demo/");
  await page.locator("#post-porch [data-conversation-trigger]").click();
  const conversation = page.getByRole("dialog", {
    name: "Conversation on June Park’s post",
  });
  await expect(conversation).toBeVisible();
  await conversation.getByRole("button", { name: "Like", exact: true }).click();
  await expect(
    conversation.getByRole("button", { name: "Liked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await conversation
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill("A comment from this demo visitor.");
  await conversation.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    conversation.getByText("A comment from this demo visitor.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await navigate(page, "Messages");
  await navigate(page, "Feed");
  await page.locator("#post-porch [data-conversation-trigger]").click();
  await expect(
    conversation.getByText("A comment from this demo visitor.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    conversation.getByRole("button", { name: "Liked", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("creates a post and keeps bundled Gallery photographs available without device uploads", async ({
  page,
}) => {
  await page.goto("/demo/?view=profile");
  await page
    .getByRole("button", { name: "View photograph 1 of 3", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "View More", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/\?view=gallery/);
  await expect(
    page.getByRole("heading", { name: "Your Gallery", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Arrange gallery", exact: true }),
  ).toBeEnabled();
  await menu(page, "View profile");
  await page.getByRole("button", { name: "New Post", exact: true }).click();
  const composer = page.getByRole("dialog", { name: "New Post", exact: true });
  await composer
    .getByRole("textbox", { name: "Your post", exact: true })
    .fill("A new fictional post, kept in this tab.");
  await composer.getByRole("button", { name: /^Add photographs?$/ }).click();
  const picker = page.getByRole("dialog", {
    name: "Choose a photograph",
    exact: true,
  });
  await expect(picker.locator('input[type="file"]')).toBeDisabled();
  await picker
    .getByRole("button", { name: /^Select / })
    .first()
    .click();
  await picker
    .getByRole("button", { name: "Use photograph", exact: true })
    .click();
  await composer
    .getByRole("button", { name: "Share with friends", exact: true })
    .click();
  await expect(
    page.getByText("A new fictional post, kept in this tab.", { exact: true }),
  ).toBeVisible();
  await navigate(page, "Feed");
  await menu(page, "View profile");
  await expect(
    page.getByText("A new fictional post, kept in this tab.", { exact: true }),
  ).toBeVisible();
});

test("saves local messages and Notebook entries", async ({ page }) => {
  await page.goto("/demo/?view=messages");
  await page
    .getByRole("button", { name: "Open notebook", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Note to self", exact: true })
    .fill("A note kept only in this demo.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Notebook entries" })
      .getByText("A note kept only in this demo.", { exact: true }),
  ).toBeVisible();
  if (page.viewportSize()!.width < 1024)
    await page
      .getByRole("button", { name: "Back to messages", exact: true })
      .click();
  await page
    .getByRole("button", {
      name: "Open conversation with June Park",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Message to June Park", exact: true })
    .fill("A simulated hello.");
  await page
    .getByRole("button", { name: "Add message to local preview", exact: true })
    .click();
  await expect(
    page
      .getByRole("list", { name: "Messages with June Park", exact: true })
      .getByText("You: A simulated hello.", { exact: true }),
  ).toBeVisible();
});

test("edits Top Four and accepts a fictional friend request entirely locally", async ({
  page,
}) => {
  await page.goto("/demo/?view=profile");
  const card = page.getByRole("region", { name: "Top 4", exact: true });
  await card.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit Top 4", exact: true });
  await editor
    .getByRole("button", { name: "Remove Theo Marchetti", exact: true })
    .click();
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card.getByRole("link")).toHaveCount(3);
  await menu(page, "Friends");
  await page.getByRole("button", { name: /Requests/ }).click();
  await page
    .getByRole("button", { name: /Accept.*Nadia|Accept request/i })
    .click();
  await page.getByRole("button", { name: /^Friends ·/ }).click();
  await page.getByRole("link", { name: /Nadia Haddad/ }).click();
  await expect(
    page.getByRole("heading", { name: "Nadia Haddad", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/A good afternoon in the lab/)).toBeVisible();
});

test("opens a Space, posts a comment and retains it in the main Feed", async ({
  page,
}) => {
  await page.goto("/demo/?view=spaces");
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await expect(
    page.getByRole("heading", { name: "Japan 2027", exact: true }),
  ).toBeVisible();
  await page.locator(".margin-space-options summary").click();
  await page
    .getByRole("checkbox", { name: "Include posts from this Space in my Feed" })
    .check();
  const post = page.locator("#space-sample-1");
  await post.getByRole("button", { name: /Conversation on/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill("Let’s explore Kyoto together.");
  await dialog.getByRole("button", { name: "Post", exact: true }).click();
  await expect(
    dialog.getByText("Let’s explore Kyoto together.", { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await navigate(page, "Feed");
  await page
    .locator("#space-sample-1")
    .getByRole("button", { name: /Conversation on/ })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Let’s explore Kyoto together.", { exact: true }),
  ).toBeVisible();
});

test("rejects unexpected backend requests before sending and explains the failure", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const sent: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" ||
        request.url().includes("service.invalid") ||
        new URL(request.url()).pathname.startsWith("/api/") ||
        new URL(request.url()).pathname === "/unexpected-backend"
      )
        sent.push(request.url());
    });
    await page.goto(`${baseURL}/demo/`);
    await expect(
      page.getByRole("heading", { name: "Feed", exact: true }),
    ).toBeVisible();
    const results = await page.evaluate(async () => {
      return Promise.all(
        ["/api/posts", "/unexpected-backend", "https://service.invalid/write"]
          .flatMap((url) => ["GET", "POST"].map((method) => ({ url, method })))
          .map(async ({ url, method }) => {
            try {
              await fetch(url, {
                method,
                ...(method === "POST" ? { body: "fictional test" } : {}),
              });
              return "unexpected success";
            } catch (error) {
              return String(error);
            }
          }),
      );
    });
    expect(
      results.every((result) =>
        result.includes("Demo blocked an unexpected backend request"),
      ),
    ).toBe(true);
    const transports = await page.evaluate(() => {
      const attempts = [
        () => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", "/api/private");
          xhr.send();
        },
        () => new WebSocket(`ws://${location.host}/api/private`),
        () => new EventSource("/api/private"),
        () => navigator.sendBeacon("/api/private", "fictional test"),
      ];
      return attempts.map((attempt) => {
        try {
          attempt();
          return "unexpected success";
        } catch (error) {
          return String(error);
        }
      });
    });
    expect(
      transports.every((result) => result.includes("No data was sent.")),
    ).toBe(true);
    expect(sent).toEqual([]);
    await expect(
      page.getByRole("alert").filter({ hasText: "No data was sent." }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("keeps keyboard navigation and narrow layouts usable with local reading preferences", async ({
  page,
}, info) => {
  await page.goto("/demo/?view=settings");
  const link = page.getByRole("link", { name: "Skip to content", exact: true });
  await link.focus();
  await expect(link).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Larger", exact: true }).check();
  await page.getByRole("radio", { name: "Reduce motion", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reading-size",
    "larger",
  );
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("demo-settings-narrow.png"),
    fullPage: true,
  });
});

test("keeps the demo disclosure, desktop message composer and footer inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/demo/?view=messages&thread=ines");
  const input = page.getByRole("textbox", {
    name: "Note to self",
    exact: true,
  });
  await input.fill("A note that stays inside the available viewport.");
  await expect(input).toBeInViewport({ ratio: 0.99 });
  await page.setViewportSize({ width: 1280, height: 500 });
  await input.fill("A growing focused draft. ".repeat(20));
  await expect(input).toBeInViewport({ ratio: 0.99 });
  await expect(
    page.getByRole("navigation", { name: "Footer", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("complementary", { name: "Interactive demonstration" }),
  ).toBeInViewport({ ratio: 1 });
});

test("Exit demo clears profile and Space changes before returning to the welcome page", async ({
  page,
}) => {
  await page.goto("/demo/?view=profile");
  const latest = page.locator("#post-fog");
  const older = page.locator("#post-profile-beach");
  await expect(latest.locator("img")).toHaveCount(2);
  const beach = await older.locator("img").getAttribute("src");
  expect(
    await latest
      .locator("img")
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute("src")),
      ),
  ).not.toContain(beach);
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Profile menu", exact: true })
    .getByRole("button", { name: "Edit profile", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Temporary visitor name");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Temporary visitor name", exact: true }),
  ).toBeVisible();
  await navigate(page, "Spaces");
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  const post = page.locator("#space-sample-1");
  await post.getByRole("button", { name: /Conversation/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "Add a comment", exact: true })
    .fill("Temporary Space comment");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Post", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Back to post", exact: true })
    .click();
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  const profileMenu = page.getByRole("navigation", {
    name: "Profile menu",
    exact: true,
  });
  await expect(
    profileMenu.getByRole("link", { name: "Privacy", exact: true }),
  ).toHaveCount(0);
  await profileMenu
    .getByRole("button", { name: "Exit demo", exact: true })
    .click();
  await expect(page).toHaveURL(`${new URL(page.url()).origin}/`);
  await expect(
    page.getByRole("heading", {
      name: "A feed that ends. Imagine.",
      exact: true,
    }),
  ).toBeVisible();
  // Earlier demo history entries must not resurrect the exited session either.
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "Profile menu", exact: true }),
  ).toBeVisible();
  await menu(page, "View profile");
  await expect(
    page.getByRole("heading", { name: "Ines Alvarez", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Profile menu", exact: true })
    .getByRole("button", { name: "Exit demo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A feed that ends. Imagine.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore Demo", exact: true })
    .first()
    .click();
  await menu(page, "View profile");
  await expect(
    page.getByRole("heading", { name: "Ines Alvarez", exact: true }),
  ).toBeVisible();
  await navigate(page, "Spaces");
  await page.getByRole("link", { name: /Japan 2027/ }).click();
  await page
    .locator("#space-sample-1")
    .getByRole("button", { name: /Conversation/ })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Temporary Space comment", { exact: true }),
  ).toHaveCount(0);
});

test("static fetches omit existing cookies, authorization and referrers", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  try {
    await context.addCookies([
      {
        name: "demo_test_cookie",
        value: "fictional-cookie-canary",
        url: baseURL!,
      },
    ]);
    const page = await context.newPage();
    await page.goto(`${baseURL}/demo/`);
    await expect(
      page.getByRole("heading", { name: "Feed", exact: true }),
    ).toBeVisible();
    const sent = page.waitForRequest(
      (request) => new URL(request.url()).pathname === "/robots.txt",
    );
    expect(
      await page.evaluate(
        async () =>
          (
            await fetch("/robots.txt", {
              credentials: "include",
              headers: {
                Authorization: "Bearer fictional-authorization-canary",
              },
            })
          ).status,
      ),
    ).toBe(200);
    const headers = await (await sent).allHeaders();
    expect(headers.cookie).toBeUndefined();
    expect(headers.authorization).toBeUndefined();
    expect(headers.referer).toBeUndefined();
  } finally {
    await context.close();
  }
});

// This scenario intentionally navigates to a real 404, outside the normal-success network fixture.
base(
  "unavailable pages keep their 404 status and offer usable branded recovery",
  async ({ page, baseURL }, info) => {
    const errors: string[] = [];
    const services: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(baseURL!).origin ||
        url.pathname.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method())
      )
        services.push(request.url());
    });
    const response = await page.goto("/app/");
    expect(response?.status()).toBe(404);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", {
        name: "This page isn’t part of the demo.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "margin home", exact: true }),
    ).toBeVisible();
    for (const label of ["Explore Demo", "Back to Margin"]) {
      const action = main.getByRole("link", { name: label, exact: true });
      await expect(action).toBeVisible();
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("demo-unavailable.png"),
      fullPage: true,
    });
    await main.getByRole("link", { name: "Explore Demo", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Feed", exact: true }),
    ).toBeVisible();
    expect((await page.goto("/app/"))?.status()).toBe(404);
    await page
      .getByRole("main")
      .getByRole("link", { name: "Back to Margin", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "A feed that ends. Imagine.",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    expect(services).toEqual([]);
  },
);
