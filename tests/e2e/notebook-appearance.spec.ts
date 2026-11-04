import { test, expect } from "./fixtures";
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
  await page.screenshot({ path: info.outputPath("notebook.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(header.locator(".margin-page")).toHaveCSS(
    "animation-name",
    "none",
  );
});
