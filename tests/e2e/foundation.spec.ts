import { expect, test } from "./fixtures";

test("public provider marks are served as SVG and decode without a session", async ({
  page,
  request,
}) => {
  const paths = [
    "/brands/apple-music.svg",
    "/brands/spotify.svg",
    "/brands/itunes-store.svg",
  ];
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  }
  await page.goto("/");
  expect(
    await page.evaluate(
      async (assets) =>
        Promise.all(
          assets.map(async (src) => {
            const image = new Image();
            image.src = src;
            await image.decode();
            return image.naturalWidth > 0 && image.naturalHeight > 0;
          }),
        ),
      paths,
    ),
  ).toEqual([true, true, true]);
});

test("public shell is responsive, keyboard accessible, and uses a fresh CSP nonce", async ({
  page,
  request,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    process.env.PLAYWRIGHT_PRODUCTION === "1"
      ? /A little less\.\s*A little closer\./
      : "Feed",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const csp = response?.headers()["content-security-policy"] ?? "";
  const headers = response?.headers() ?? {};
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
  expect(headers["x-powered-by"]).toBeUndefined();
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'none'");
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(
    await page
      .locator("script[nonce]")
      .first()
      .evaluate((element) => (element as HTMLScriptElement).nonce),
  ).toBe(nonce);
  const second = await request.get("/");
  expect(second.headers()["content-security-policy"]).not.toContain(
    `'nonce-${nonce}'`,
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    caret: "initial",
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
});

test("protected paths fail closed without auth credentials, including dotted paths", async ({
  request,
}) => {
  for (const path of ["/account", "/api/private.json", "/sign-in"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({
      error: "Authentication service unavailable",
    });
  }
});

test("workbench supports validation and dialog focus trapping", async ({
  page,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Workbench is development-only",
  );
  await page.goto("/design-system");
  await page.getByRole("button", { name: "Check example" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Enter at least 2 characters.",
  );
  const input = page.getByRole("textbox", { name: "Example label" });
  await expect(input).toBeFocused();
  await input.fill("A clear label");
  await page.getByRole("button", { name: "Check example" }).click();
  await expect(page.getByRole("status")).toContainText("Nothing was saved");
  const trigger = page.getByRole("button", { name: "Preview dialog" });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "A little more context" }),
  ).toBeVisible();
  const close = page.getByRole("button", { name: "Close dialog" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("retired job URLs cannot execute or register jobs", async ({
  request,
}) => {
  for (const method of ["GET", "POST", "PUT"]) {
    expect((await request.fetch("/api/inngest", { method })).status()).toBe(
      404,
    );
  }
});

test("production hides the workbench and excludes development CSP permissions", async ({
  request,
}) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION !== "1",
    "Production boundary check",
  );
  expect((await request.get("/design-system")).status()).toBe(404);
  const html = await (await request.get("/")).text();
  expect(html).not.toContain("post-fog");
  expect(html).not.toContain("Ines Alvarez");
  for (const query of ["?view=messages&thread=ines", "?view=profile"]) {
    const previewHtml = await (await request.get(`/${query}`)).text();
    expect(previewHtml).not.toContain("Ines Alvarez");
    expect(previewHtml).not.toContain("Meet at the lot");
    expect(previewHtml).toMatch(
      /<h1[^>]*>A little less\.<br\s*\/?\s*>A little closer\.<\/h1>/,
    );
  }
  const csp = (await request.get("/")).headers()["content-security-policy"];
  expect(csp).not.toContain("'unsafe-eval'");
  expect((await request.get("/")).headers()["strict-transport-security"]).toBe(
    "max-age=31536000",
  );
});
