import { test, expect } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test.beforeEach(async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Member rendering fixture; real database boundaries have integration coverage",
  );
  await memberFixture(page);
});

test("keeps one through four Top 4 entries in four compact columns without mobile overflow", async ({
  page,
}) => {
  const people = [
    "Alex Example",
    "Morgan With A Long Name",
    "Casey",
    "Robin",
  ].map((name, index) => ({
    id: `top-friend-${index}`,
    name,
    initials: name.slice(0, 2),
    tone: "paper",
  }));
  let selected: typeof people = [];
  await page.route(
    "**/__member_fixture/api/profiles/me/top-friends**",
    async (route) => {
      if (route.request().method() === "PUT") {
        const { friendIds } = route.request().postDataJSON();
        selected = friendIds.map((id: string) =>
          people.find((person) => person.id === id),
        );
        return route.fulfill({ json: { selected } });
      }
      return route.fulfill({
        json: {
          selected,
          contacts: people.map((person) => ({
            person,
            username: "",
            relationship: "friends",
          })),
          nextCursor: null,
        },
      });
    },
  );
  await page.goto("/preview/auth?view=member&area=profile");
  await page.getByRole("button", { name: "Choose your Top 4" }).click();
  for (let count = 1; count <= 4; count++) {
    const dialog = page.getByRole("dialog", { name: "Edit Top 4" });
    await dialog
      .getByRole("button", {
        name: `Add ${people[count - 1].name}`,
        exact: true,
      })
      .click();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const card = page.getByRole("region", { name: "Top 4", exact: true });
    await expect(card.getByRole("link")).toHaveCount(count);
    const metrics = await card.evaluate((node) => {
      const grid = node.querySelector(".margin-top-friends-grid")!;
      const links = [...grid.querySelectorAll("a")].map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
        };
      });
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        links,
        right: node.getBoundingClientRect().right,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(metrics.columns).toBe(4);
    expect(metrics.overflow).toBe(false);
    expect(new Set(metrics.links.map((link) => link.top)).size).toBe(1);
    for (const link of metrics.links) {
      expect(link.width).toBeGreaterThanOrEqual(44);
      expect(link.height).toBeGreaterThanOrEqual(44);
      expect(link.right).toBeLessThanOrEqual(metrics.right);
    }
    if (count < 4)
      await card.getByRole("button", { name: "Edit", exact: true }).click();
  }
  // Same production component remains usable at the narrowest supported phone width.
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const links = page
    .getByRole("region", { name: "Top 4", exact: true })
    .getByRole("link");
  for (const link of await links.all())
    expect((await link.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect(await page.pageErrors()).toEqual([]);
});

test("omits an empty visitor section entirely and keeps the existing cards at natural heights", async ({
  page,
}) => {
  await page.goto("/preview/auth?view=member&area=friend-profile");
  await expect(
    page.getByRole("region", { name: "Top 4", exact: true }),
  ).toHaveCount(0);
  const details = page.locator(".margin-profile-details");
  await expect(details.locator(":scope > section")).toHaveCount(2);
  const heights = await details
    .locator(":scope > section")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
  expect(heights.every((height) => height > 0)).toBe(true);
  const style = await details.evaluate((node) => ({
    rows: getComputedStyle(node).gridAutoRows,
    height: node.getBoundingClientRect().height,
    gap: parseFloat(getComputedStyle(node).rowGap),
  }));
  expect(style.rows).toBe("auto");
  expect(
    Math.abs(
      style.height -
        heights.reduce((sum, height) => sum + height, 0) -
        style.gap,
    ),
  ).toBeLessThan(2);
});
