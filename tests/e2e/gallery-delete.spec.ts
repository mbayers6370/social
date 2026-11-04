import { expect, test } from "./fixtures";
import { memberFixture } from "./helpers/member-fixture";

test("offers direct Gallery deletion, preserves the photo on failure and removes it after confirmation", async ({
  page,
}, info) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Development fixture");
  await memberFixture(page);
  let calls = 0;
  await page.route(
    "**/__member_fixture/api/photos/fictional-photo",
    (route) => {
      if (route.request().method() !== "DELETE") return route.fallback();
      calls++;
      return route.fulfill(
        calls === 1
          ? {
              status: 409,
              json: {
                error: "Couldn’t delete this photograph. Please try again.",
              },
            }
          : { status: 200, json: {} },
      );
    },
  );
  await page.goto("/preview/auth?view=member&area=gallery-photos");
  const photo = page.locator('[data-gallery-item="fictional-photo"]');
  const remove = page.getByRole("button", {
    name: "Delete photograph 1",
    exact: true,
  });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Delete this photograph?" });
  await expect(dialog).toContainText(
    "still counts toward today’s upload allowance",
  );
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(calls).toBe(0);
  await expect(remove).toBeFocused();
  await remove.click();
  await page.screenshot({ path: info.outputPath("gallery-delete.png") });
  await dialog
    .getByRole("button", { name: "Delete photograph", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Couldn’t delete");
  await expect(photo).toHaveCount(1);
  await dialog
    .getByRole("button", { name: "Delete photograph", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(photo).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(
    page.getByRole("heading", { name: "Your Gallery" }),
  ).toBeFocused();
});
