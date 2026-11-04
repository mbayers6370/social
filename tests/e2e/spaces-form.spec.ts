import { test, expect } from "./fixtures";
test("Create a Space offers optional plans and a keyboard-accessible calendar", async ({
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
  await expect(create.getByRole("radio")).toHaveCount(0);
  await expect(create.getByLabel("Date", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("simple-space.png") });
  await create.getByRole("button", { name: "Add a date and time" }).click();
  await create.getByLabel("Space name").fill("Dinner with friends");
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

test("creates a name-only Space, adds and removes plans, and archives without losing posts", async ({
  page,
}, info) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Local Spaces preview");
  await page.goto("/preview/spaces");
  await page.getByRole("button", { name: "New Space" }).click();
  let dialog = page.getByRole("dialog", { name: "Create a Space" });
  await dialog.getByLabel("Space name").fill("Our people");
  await dialog
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Our people", exact: true }),
  ).toBeVisible();
  const spaceUrl = page.url();
  await expect(page.getByRole("group", { name: "Your RSVP" })).toHaveCount(0);
  await page.getByRole("button", { name: "Share a thought…" }).click();
  await page
    .getByLabel("Your post", { exact: true })
    .fill("Keep our conversation.");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const post = page
    .getByRole("article")
    .filter({ hasText: "Keep our conversation." });
  await expect(post).toBeVisible();
  const options = page.locator(".margin-space-options");
  await options.locator("summary").click();
  await options.getByRole("button", { name: "Edit details" }).click();
  dialog = page.getByRole("dialog", { name: "Edit Space details" });
  await dialog.getByRole("button", { name: "Add a date and time" }).click();
  await dialog.getByLabel("Date", { exact: true }).fill("2028-02-29");
  await dialog.getByLabel("Time", { exact: true }).fill("18:30");
  await dialog.getByRole("checkbox", { name: "Show a location" }).check();
  await dialog.getByLabel("Location", { exact: true }).fill("At home");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page).toHaveURL(spaceUrl);
  await expect(
    page.getByRole("region", { name: "Date and place" }),
  ).toContainText("At home");
  await page
    .getByRole("group", { name: "Your RSVP" })
    .getByRole("button", { name: "Going", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Going", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await options.getByRole("button", { name: "Edit details" }).click();
  dialog = page.getByRole("dialog", { name: "Edit Space details" });
  await dialog.getByRole("button", { name: "Remove date and time" }).click();
  await dialog.getByRole("checkbox", { name: "Show a location" }).uncheck();
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page).toHaveURL(spaceUrl);
  await expect(page.getByRole("group", { name: "Your RSVP" })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Date and place" }),
  ).toHaveCount(0);
  await expect(post).toBeVisible();
  await options
    .getByRole("button", { name: "Archive Space", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Archive Space", exact: true })
    .click();
  await expect(
    page.getByText(/This Space is archived\. You can still read/),
  ).toBeVisible();
  await expect(post).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share a thought…" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("space-without-plans-archived.png"),
    fullPage: true,
  });
});
