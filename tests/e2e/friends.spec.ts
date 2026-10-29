import { expect, test } from "@playwright/test";
test.beforeEach(() =>
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Friendships are development-only",
  ),
);
test("uses the responsive navigation and manages local friendships across screens", async ({
  page,
}) => {
  await page.goto("/");
  const mobile = page.viewportSize()!.width < 1024;
  const header = page.locator(".margin-header");
  const bottom = page.getByRole("navigation", { name: "Mobile navigation" });
  if (mobile) {
    await expect(
      page.getByRole("button", { name: "Share a thought…", exact: true }),
    ).toBeVisible();
    await expect(
      header.getByRole("button", { name: /^Notifications,/ }),
    ).toBeVisible();
    await expect(
      bottom.getByRole("button", { name: /^Notifications,/ }),
    ).toHaveCount(0);
    await expect(bottom.getByRole("link")).toHaveCount(3);
    await expect(bottom.getByRole("button", { name: "New post" })).toHaveCount(
      0,
    );
  } else {
    const controls = [
      header.getByRole("button", { name: "Search profiles" }),
      header.getByRole("button", { name: /^Notifications,/ }),
      header.getByRole("button", { name: "Profile menu", exact: true }),
    ];
    const bounds = await Promise.all(
      controls.map((control) => control.boundingBox()),
    );
    expect(bounds.every(Boolean)).toBe(true);
    expect(bounds[1]!.x - bounds[0]!.x - bounds[0]!.width).toBeCloseTo(8, 0);
    expect(bounds[2]!.x - bounds[1]!.x - bounds[1]!.width).toBeCloseTo(8, 0);
    for (const bound of bounds) expect(bound!.width).toBeCloseTo(44, 0);
  }
  if (mobile)
    await bottom.getByRole("link", { name: "Profile", exact: true }).click();
  else {
    await header.getByRole("button", { name: "Profile menu" }).click();
    await header.getByRole("link", { name: "View profile" }).click();
  }
  await page.getByRole("link", { name: "Friends", exact: true }).click();
  await page.getByRole("button", { name: /Requests/ }).click();
  await page
    .getByRole("button", { name: "Accept request", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "You and Nadia Haddad are now friends.",
  );
  await page.getByRole("button", { name: /^Friends \d+$/ }).click();
  const manage = page.getByRole("button", {
    name: "Manage friendship with Nadia Haddad",
  });
  await manage.click();
  const confirm = page.getByRole("alertdialog");
  await expect(
    confirm.getByRole("button", { name: "Keep friend" }),
  ).toBeFocused();
  await confirm
    .getByRole("button", { name: "Remove friend", exact: true })
    .click();
  await expect(manage).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Friends", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Requests/ }).click();
  await page
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(page.getByText("No outgoing requests.")).toBeVisible();
});
