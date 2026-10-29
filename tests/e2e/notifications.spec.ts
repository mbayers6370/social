import { expect, test } from "@playwright/test";
test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Notification fixtures are development-only",
  ),
);
test("opens responsive notifications and follows a reply into its expanded conversation", async ({
  page,
}) => {
  await page.goto("/");
  const bell = page.getByRole("button", {
    name: /^Notifications, \d+ unread$/,
  });
  await bell.click();
  const panel = page.getByRole("dialog", {
    name: "Notifications",
    exact: true,
  });
  await expect(panel).toBeVisible();
  const bounds = (await panel.boundingBox())!;
  if (page.viewportSize()!.width >= 1024) {
    await expect(panel).not.toHaveAttribute("aria-modal", "true");
    const header = (await page.locator(".margin-header").boundingBox())!;
    expect(bounds.y).toBeGreaterThan(header.y + header.height);
    expect(bounds.x + bounds.width).toBeLessThan(page.viewportSize()!.width);
  } else {
    await expect(panel).toHaveAttribute("aria-modal", "true");
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBeCloseTo(page.viewportSize()!.width, 0);
    expect(bounds.height).toBeCloseTo(page.viewportSize()!.height, 0);
  }
  await panel.getByRole("button", { name: /June Park replied to you/ }).click();
  const conversation = page.getByRole("dialog", {
    name: "Conversation on June Park’s post",
  });
  await expect(conversation).toBeVisible();
  await expect(
    conversation.getByText("He's been out there all afternoon."),
  ).toBeVisible();
  await expect(
    conversation.getByRole("button", { name: "Hide replies" }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(conversation).not.toBeVisible();
  await bell.click();
  await panel.getByRole("button", { name: "Mark all as read" }).click();
  if (page.viewportSize()!.width < 1024)
    await panel
      .getByRole("button", { name: "Back from notifications" })
      .click();
  else await panel.getByRole("button", { name: "Close notifications" }).click();
  await expect(bell).toHaveAccessibleName("Notifications, 0 unread");
  await expect(bell).toBeFocused();
});
