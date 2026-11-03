import { expect, test } from "./fixtures";

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
  test("shares one link repeatedly, copies it, and withdraws it without restoring allowance", async ({
    page,
  }) => {
    let issues = 0;
    let revoked = false;
    const link = {
      id: "personal",
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
        await route.fulfill({ status: 201, json: link });
      } else
        await route.fulfill({
          json: {
            founder: false,
            remaining: 3 - issues,
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
    await expect(
      dialog.getByText(/3 of 3 invitations remaining/),
    ).toBeVisible();
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    expect(issues).toBe(0);
    await dialog
      .getByRole("button", { name: "Share invitation", exact: true })
      .click();
    await expect(dialog.getByLabel("Your invitation link")).toHaveValue(
      link.url,
    );
    await expect
      .poll(() => page.evaluate(() => window.invitationShares.length))
      .toBe(1);
    await dialog
      .getByRole("button", { name: "Share invitation", exact: true })
      .click();
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
    await dialog.locator("summary").click();
    await dialog.getByRole("button", { name: "Withdraw invitation" }).click();
    await expect(
      dialog.getByText(/does not restore your allowance/),
    ).toBeVisible();
    await expect(
      dialog.getByText(/2 of 3 invitations remaining/),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Invite someone" }),
    ).toBeFocused();
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
    await page.screenshot({
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
    await expect(
      dialog.getByText("Founder · Unlimited invitations"),
    ).toBeVisible();
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
      .getByRole("button", { name: "Copy link", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText("Try again");
    await dialog
      .getByRole("button", { name: "Copy link", exact: true })
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
