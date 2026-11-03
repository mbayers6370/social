import { test, expect } from "./fixtures";
test("Create a Space uses branded choices and a keyboard-accessible calendar", async ({
  page,
}, info) => {
  test.skip(
    process.env.PLAYWRIGHT_PRODUCTION === "1",
    "Development Spaces form",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/preview/spaces");
  await page.getByRole("button", { name: "New Space" }).click();
  const create = page.getByRole("dialog", { name: "Create a Space" });
  const privateChoice = create.getByRole("radio", {
    name: "Private Space",
    exact: true,
  });
  await expect(privateChoice).toBeChecked();
  await privateChoice.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    create.getByRole("radio", { name: "Gathering Space", exact: true }),
  ).toBeChecked();
  await page.screenshot({ path: info.outputPath("space-types.png") });
  await create.getByLabel("Gathering Space name").fill("Dinner with friends");
  await create.getByLabel("Date", { exact: true }).fill("2028-02-28");
  await create.getByLabel("Time", { exact: true }).fill("18:30");
  await create
    .getByRole("combobox", { name: "Time zone" })
    .fill("America/Los_Angeles");
  await page.keyboard.press("Escape");
  await expect(create).toBeVisible();
  await expect(create.getByRole("listbox")).toHaveCount(0);
  await create
    .getByRole("combobox", { name: "Time zone" })
    .fill("America/Los_Angeles");
  await page.screenshot({ path: info.outputPath("time-zone-dropdown.png") });
  await create
    .getByRole("option", { name: "America / Los Angeles", exact: true })
    .click();
  const dateInput = await create
    .getByLabel("Date", { exact: true })
    .boundingBox();
  const calendarButton = create.getByRole("button", { name: "Choose date" });
  await calendarButton.hover();
  const trigger = await calendarButton.boundingBox();
  expect(trigger!.x).toBeGreaterThan(dateInput!.x + 1);
  expect(trigger!.y).toBeGreaterThan(dateInput!.y + 1);
  expect(trigger!.x + trigger!.width).toBeLessThan(
    dateInput!.x + dateInput!.width - 1,
  );
  expect(trigger!.y + trigger!.height).toBeLessThan(
    dateInput!.y + dateInput!.height - 1,
  );
  await create
    .locator(".margin-space-date-control")
    .screenshot({ path: info.outputPath("calendar-hover.png") });
  await create.getByRole("button", { name: "Choose date" }).click();
  const calendar = page.getByRole("dialog", {
    name: "Choose date",
    exact: true,
  });
  await expect(
    calendar.getByRole("grid", { name: "February 2028" }),
  ).toBeVisible();
  await expect(
    calendar.getByRole("button", {
      name: "Monday, February 28, 2028",
      exact: true,
    }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath("space-calendar.png") });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(create.getByLabel("Date", { exact: true })).toHaveValue(
    "2028-02-29",
  );
  await expect(
    create.getByRole("button", { name: "Choose date" }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath("create-space.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await create
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dinner with friends", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
