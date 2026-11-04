import { captureScreenshot, expect, test } from "./fixtures";

declare global {
  interface Window {
    invitationShares: ShareData[];
    invitationCopies: string[];
  }
}

test("direct signup has no code or public registration action; shared-link previews never issue invitations", async ({
  page,
}) => {
  await page.goto("/welcome");
  await expect(page.locator('a[href="/sign-up"]')).toHaveCount(0);
  await page.goto("/sign-up");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByText(/Open the invitation link someone sent you/),
  ).toBeVisible();
  const result = await page.goto(`/invite/${"a".repeat(43)}`);
  expect(result?.status()).toBe(200);
  expect(result?.headers()["cache-control"]).toContain("no-store");
  expect(result?.headers()["cache-control"]).not.toContain("public");
  expect(result?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByText(/Your link has not been used/)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const blocked = await page.request.post(`/api/invite/${"a".repeat(43)}`, {
    data: { email: "fixture@example.test" },
  });
  expect(blocked.status()).toBe(503);
  const fixture = await page.request.get("/preview/invitations");
  if (process.env.PLAYWRIGHT_PRODUCTION === "1")
    expect(fixture.status()).toBe(404);
});

test.describe("invitation interaction fixtures, not live provider delivery", () => {
  test.beforeEach(() =>
    test.skip(
      process.env.PLAYWRIGHT_PRODUCTION === "1",
      "Development-only component fixture",
    ),
  );
  test("shares one link repeatedly, copies it, and withdraws it to free its slot", async ({
    page,
  }) => {
    let issues = 0;
    let revoked = false;
    const link = {
      id: "personal",
      label: "Sam",
      url: `https://margin.social/invite/${"b".repeat(43)}`,
      expiresAt: "2026-12-01T12:00:00Z",
      accepted: 0,
      maximum: 1,
    };
    await page.addInitScript(() => {
      window.invitationShares = [];
      window.invitationCopies = [];
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          window.invitationShares.push(data);
        },
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            window.invitationCopies.push(text);
          },
        },
      });
    });
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() === "POST") {
        issues++;
        expect(route.request().postDataJSON()).toMatchObject({ label: "Sam" });
        await route.fulfill({ status: 201, json: link });
      } else
        await route.fulfill({
          json: {
            founder: false,
            remaining: revoked ? 3 : 3 - issues,
            links: issues ? [{ ...link, revoked }] : [],
          },
        });
    });
    await page.route("**/api/invitations/personal", async (route) => {
      revoked = true;
      await route.fulfill({ json: { revoked: true, providerPending: false } });
    });
    await page.goto("/preview/invitations");
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/3 of 3 invitations left/)).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    expect(issues).toBe(0);
    await dialog.getByRole("button", { name: "How invitations work" }).click();
    await expect(
      dialog.getByText(
        /When someone accepts your invitation and finishes joining/,
      ),
    ).toBeVisible();
    await dialog.getByLabel("Who’s this for? (optional)").fill("Sam");
    await dialog
      .getByRole("button", { name: "Create invitation link", exact: true })
      .click();
    await expect(dialog.getByLabel("Your invitation link")).toHaveValue(
      link.url,
    );
    await expect(
      dialog.getByRole("button", { name: "Copy link", exact: true }),
    ).toBeFocused();
    expect(await page.evaluate(() => window.invitationShares.length)).toBe(0);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.invitationShares.length))
      .toBe(1);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => window.invitationShares.length))
      .toBe(2);
    expect(issues).toBe(1);
    await dialog
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    expect(await page.evaluate(() => window.invitationCopies)).toEqual([
      link.url,
    ]);
    await dialog.getByRole("button", { name: "Show", exact: true }).click();
    await expect(dialog.getByText("For Sam")).toBeVisible();
    await dialog.getByRole("button", { name: "Withdraw invitation" }).click();
    await expect(dialog.getByText("For Sam")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Check withdrawal" }),
    ).toHaveCount(0);
    await expect(dialog.getByText(/Its slot is available again/)).toBeVisible();
    await expect(dialog.getByText(/3 of 3 invitations left/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Invite someone" }),
    ).toBeFocused();
  });
  test("reuses an active link and refreshes availability when acceptance frees a slot", async ({
    page,
  }) => {
    let accepted = false;
    let issues = 0;
    const links = ["one", "two", "three"].map((id) => ({
      id,
      url: `https://margin.social/invite/${id.repeat(16)}`,
      expiresAt: "2026-12-01T12:00:00Z",
      accepted: 0,
      maximum: 1,
    }));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
      });
    });
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() === "POST") {
        issues++;
        await route.fulfill({
          status: 201,
          json: { ...links[0], id: "replacement" },
        });
      } else
        await route.fulfill({
          json: {
            founder: false,
            remaining: accepted ? 1 : 0,
            links: links.map((link, index) => ({
              ...link,
              accepted: accepted && index === 0 ? 1 : 0,
            })),
          },
        });
    });
    await page.goto("/preview/invitations");
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("0 of 3 invitations left")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Invite by email" }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Invite another person" }),
    ).toHaveCount(0);
    await expect(dialog.getByLabel("Your invitation link")).toHaveValue(
      links[0].url,
    );
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    expect(issues).toBe(0);
    await captureScreenshot(page, {
      path: test.info().outputPath("invitation-full-slots.png"),
      fullPage: true,
    });
    accepted = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(dialog.getByText("1 of 3 invitations left")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copy link" }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Show", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Show link" })).toHaveCount(
      2,
    );
    await dialog.getByRole("button", { name: "Invite another person" }).click();
    await expect(
      dialog.getByRole("button", { name: "Create invitation link" }),
    ).toBeEnabled();
    await dialog
      .getByRole("button", { name: "Create invitation link" })
      .click();
    await expect(dialog.getByLabel("Your invitation link")).toBeVisible();
    expect(issues).toBe(1);
  });
  test("refreshes availability and disables sharing when a selected link expires", async ({
    page,
  }) => {
    const start = new Date("2026-10-28T17:42:00Z");
    await page.clock.install({ time: start });
    const link = {
      id: "expiring",
      url: `https://margin.social/invite/${"e".repeat(43)}`,
      expiresAt: new Date(start.getTime() + 60_000).toISOString(),
      accepted: 0,
      maximum: 1,
    };
    let reads = 0;
    await page.route("**/api/invitations", async (route) => {
      expect(route.request().method()).toBe("GET");
      reads++;
      await route.fulfill({
        json: { founder: false, remaining: reads === 1 ? 2 : 3, links: [link] },
      });
    });
    await page.goto("/preview/invitations");
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Your invitation link")).toBeVisible();
    await page.clock.runFor(60_000);
    await expect(dialog.getByText("3 of 3 invitations left")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copy link" }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Show", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Show link" })).toHaveCount(
      0,
    );
    await expect(dialog.getByText("Expired", { exact: true })).toHaveCount(2);
    expect(reads).toBeGreaterThanOrEqual(2);
  });
  test("keeps the same link through a native sharing failure and retry", async ({
    page,
  }) => {
    const link = {
      id: "sharing-link",
      url: `https://margin.social/invite/${"d".repeat(43)}`,
      expiresAt: "2026-12-01T12:00:00Z",
    };
    await page.addInitScript(() => {
      window.invitationShares = [];
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          window.invitationShares.push(data);
          if (window.invitationShares.length === 1)
            throw new Error("Unavailable");
        },
      });
    });
    await page.route("**/api/invitations", async (route) => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({
        json: { founder: false, remaining: 2, links: [link] },
      });
    });
    await page.goto("/preview/invitations");
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByText(/Sharing didn’t work/)).toBeVisible();
    await expect(dialog.getByLabel("Your invitation link")).toHaveValue(
      link.url,
    );
    await expect(
      dialog.getByRole("button", { name: "Invite another person" }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog.getByText("Invitation shared.")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Invite another person" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        window.invitationShares.map((data) => data.url),
      ),
    ).toEqual([link.url, link.url]);
  });
  test("preserves an email after a failed delivery and sends only on explicit submission", async ({
    page,
  }) => {
    let sends = 0;
    const email = `${"a".repeat(60)}@example.test`;
    await page.route("**/api/invite/*", async (route) => {
      sends++;
      expect(route.request().postDataJSON()).toEqual({
        email,
      });
      await route.fulfill(
        sends === 1
          ? { status: 503, json: { error: "Please try again later." } }
          : {
              status: 202,
              json: {
                message: "Check your inbox for your personal invitation.",
              },
            },
      );
    });
    await page.goto("/preview/invitations");
    expect(sends).toBe(0);
    await page.getByLabel("Your email address").fill(email);
    await page.getByRole("button", { name: "Email my invitation" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "try again",
    );
    await expect(page.getByLabel("Your email address")).toHaveValue(email);
    await page.getByRole("button", { name: "Email my invitation" }).click();
    await expect(page.getByRole("status")).toContainText("Check your inbox");
    expect(sends).toBe(2);
    const status = page.getByRole("status");
    for (const paragraph of await status.locator("p").all()) {
      expect(
        await paragraph.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1,
        ),
      ).toBe(true);
    }
    const statusBox = (await status.boundingBox())!;
    const cardBox = (await page.getByRole("main").boundingBox())!;
    expect(statusBox.x + statusBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width,
    );
    await captureScreenshot(page, {
      path: test.info().outputPath("invitation-email-recovery.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Your email address")).toHaveValue(email);
    await expect(page.getByLabel("Your email address")).toBeFocused();
    expect(sends).toBe(2);
  });
  test("offers community capacity and expiry only to the founder, and preserves a create retry's request ID", async ({
    page,
  }) => {
    const requests: {
      requestId: string;
      community: boolean;
      maxRedemptions: number;
      label: string;
      expiresAt: string;
    }[] = [];
    await page.route("**/api/invitations", async (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: { founder: true, remaining: 0, links: [] },
        });
      requests.push(route.request().postDataJSON());
      await route.fulfill(
        requests.length === 1
          ? {
              status: 503,
              json: { error: "Try again; your request is saved." },
            }
          : {
              status: 201,
              json: {
                id: "community",
                url: `https://margin.social/invite/${"c".repeat(43)}`,
                expiresAt: requests[0].expiresAt,
              },
            },
      );
    });
    await page.goto("/preview/invitations");
    await page.getByRole("button", { name: "Invite someone" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Unlimited invitations")).toBeVisible();
    await dialog
      .getByRole("checkbox", { name: "Create a community invitation" })
      .check();
    await dialog
      .getByLabel("Campaign label (optional)")
      .fill("Portfolio launch");
    await dialog.getByLabel("People who can join").fill("25");
    await dialog
      .getByLabel("Expiration (optional, up to 30 days)")
      .fill("2026-11-20T18:00");
    await dialog
      .getByRole("button", { name: "Create invitation link", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText("Try again");
    await dialog
      .getByRole("button", { name: "Create invitation link", exact: true })
      .click();
    await expect(dialog.getByLabel("Your invitation link")).toHaveValue(
      /margin.social\/invite\//,
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual(requests[1]);
    expect(requests[0]).toMatchObject({
      community: true,
      maxRedemptions: 25,
      label: "Portfolio launch",
    });
  });
});
