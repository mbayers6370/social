import { captureScreenshot, test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development rendering fixtures",
  ),
);
test("groups the Friends invitation action with clear spacing and bold selected tabs", async ({
  page,
}, info) => {
  await memberFixture(page);
  await page.goto("/preview/auth?view=member&area=friends");
  const intro = page.locator(".margin-friends-intro");
  const copy = intro.locator("p");
  const invite = intro.getByRole("button", {
    name: "Invite someone",
    exact: true,
  });
  const a = (await copy.boundingBox())!;
  const b = (await invite.boundingBox())!;
  const vertical = b.y >= a.y + a.height;
  expect(
    vertical ? b.y - (a.y + a.height) : b.x - (a.x + a.width),
  ).toBeGreaterThanOrEqual(15);
  const tabs = page.getByRole("tablist", { name: "Friend lists" });
  expect(
    (await tabs.boundingBox())!.y -
      ((await intro.boundingBox())!.y + (await intro.boundingBox())!.height),
  ).toBeGreaterThanOrEqual(23);
  await expect(tabs).toHaveCSS("border-bottom-width", "0px");
  const friends = tabs.getByRole("tab", { name: "Friends · 1", exact: true });
  const requests = tabs.getByRole("tab", { name: "Requests", exact: true });
  await expect(friends).toHaveCSS("font-weight", "700");
  await requests.click();
  await expect(requests).toHaveCSS("font-weight", "700");
  await expect(friends).toHaveCSS("font-weight", "400");
  await requests.press("ArrowLeft");
  await expect(friends).toBeFocused();
  await expect(friends).toHaveAttribute("aria-selected", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await captureScreenshot(page, {
    path: info.outputPath("friends-spacing.png"),
    fullPage: true,
    caret: "initial",
  });
});
test("looks up Space invitees, puts friends first and sends the chosen invitation once", async ({
  page,
}, info) => {
  const privateRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/spaces/"))
      privateRequests.push(request.url());
  });
  await page.goto("/preview/spaces");
  await page.getByRole("link", { name: /^Japan 2027/ }).click();
  await page.getByText("Members", { exact: true }).click();
  const trigger = page.getByRole("button", {
    name: "Invite someone",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Invite to this Space" });
  const input = dialog.getByRole("searchbox", { name: "Search members" });
  await expect(input).toBeFocused();
  await expect(
    dialog.getByRole("textbox", { name: /profile link/i }),
  ).toHaveCount(0);
  const first = dialog.getByRole("button", { name: /^Invite / }).first();
  await expect(first).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Your friends", exact: true }),
  ).toBeVisible();
  const name = (await first.getAttribute("aria-label"))!.replace(
    /^Invite /,
    "",
  );
  await input.fill(name);
  const selected = dialog.getByRole("button", {
    name: `Invite ${name}`,
    exact: true,
  });
  await expect(selected).toBeVisible();
  await selected.click();
  await expect(dialog.getByRole("status")).toContainText(
    `Invitation sent to ${name}.`,
  );
  await expect(
    dialog.getByRole("button", { name: `${name} invited`, exact: true }),
  ).toBeDisabled();
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.86);
  await captureScreenshot(page, {
    path: info.outputPath("space-invite-lookup.png"),
    caret: "initial",
  });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(privateRequests).toEqual([]);
});
