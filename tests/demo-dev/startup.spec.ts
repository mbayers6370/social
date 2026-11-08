import { expect, test } from "@playwright/test";

test("the normal development command opens the welcome page and an anonymous interactive demo", async ({
  page,
  baseURL,
}, info) => {
  const failures: string[] = [];
  const sockets: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("request", (request) => {
    if (
      new URL(request.url()).origin !== baseURL ||
      new URL(request.url()).pathname.startsWith("/api/")
    )
      failures.push(request.url());
  });
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A feed that ends. Imagine.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Explore Demo", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/demo\//);
  await expect(page.locator("#post-book")).toContainText("Theo Marchetti");
  const nav = page.getByRole("navigation", {
    name: info.project.name === "mobile" ? "Mobile navigation" : "Primary",
    exact: true,
  });
  await nav.getByRole("link", { name: "Messages", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Messages", exact: true }),
  ).toBeVisible();
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  expect(
    sockets.every((socket) => new URL(socket).pathname === "/_next/hmr"),
  ).toBe(true);
  expect(failures).toEqual([]);
});
