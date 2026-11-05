import { captureScreenshot, test, expect } from "./fixtures";
test("Notebook uses an animated outlined book and the shared light conversation header", async ({
  page,
  isMobile,
}, info) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION === "1", "Notebook preview");
  await page.goto("/?view=messages");
  const row = page.locator('.margin-thread-choice[data-notebook="true"]');
  await expect(row).toBeVisible();
  await expect(row).toHaveCSS(
    "background-color",
    isMobile ? "rgb(255, 255, 255)" : "rgba(185, 198, 90, 0.35)",
  );
  await expect(row.locator(".margin-notebook-icon")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(row.locator(".margin-notebook-icon")).toHaveCSS(
    "border-top-color",
    "rgb(48, 56, 61)",
  );
  await expect(row.locator(".margin-notebook-icon svg")).toHaveAttribute(
    "data-animate",
    "true",
  );
  await expect(row.locator(".margin-notebook-icon svg")).toHaveCSS(
    "color",
    "rgb(48, 56, 61)",
  );
  await row.getByRole("button", { name: "Open notebook" }).click();
  const notebook = page.getByRole("region", { name: "Notebook", exact: true });
  await expect(notebook).toBeVisible();
  const header = notebook.locator(".margin-thread-header");
  await expect(header).toHaveCSS("background-color", "rgb(243, 242, 240)");
  await expect(header.locator(".margin-notebook-icon")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(header.locator(".margin-notebook-icon")).toHaveCSS(
    "border-top-color",
    "rgb(48, 56, 61)",
  );
  await expect(header.locator(".margin-notebook-icon svg")).toHaveCSS(
    "color",
    "rgb(48, 56, 61)",
  );
  await expect(header.locator(".margin-page")).toHaveCSS(
    "animation-name",
    "margin-page",
  );
  await expect(notebook.getByText("Nothing here yet.")).toBeVisible();
  const composer = notebook.locator(".margin-message-composer");
  await expect(composer).toBeInViewport({ ratio: 1 });
  await expect(
    composer.getByText("Enter to save · Shift+Enter for a new line"),
  ).toBeVisible();
  await composer
    .getByRole("textbox", { name: "Note to self" })
    .fill("A journal page.");
  await composer.getByRole("button", { name: "Save note" }).click();
  const entry = notebook
    .getByRole("list", { name: "Notebook entries" })
    .getByRole("listitem")
    .last();
  await expect(entry.locator(".margin-notebook-expiry")).toContainText(
    "expires",
  );
  await expect(entry.locator(".margin-notebook-body")).toHaveCSS(
    "white-space",
    "pre-wrap",
  );
  const history = notebook.locator(".margin-thread-scroll");
  const geometry = await history.evaluate((element) => {
    const body = element
      .querySelector(".margin-notebook-body")!
      .getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      width: body.width,
      available:
        rect.width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
    };
  });
  expect(Math.abs(geometry.width - geometry.available)).toBeLessThan(3);
  await captureScreenshot(page, { path: info.outputPath("notebook.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(header.locator(".margin-page")).toHaveCSS(
    "animation-name",
    "none",
  );
});
