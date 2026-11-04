// @vitest-environment node
import { expect, it } from "vitest";
import { GET } from "@/app/icon/route";
import {
  brandCornerPath,
  brandMonogramPath,
} from "@/components/shared/brand-mark";

it.each([
  ["light", "#454D24"],
  ["dark", "#B9C65A"],
] as const)(
  "serves the %s monogram as a public SVG with the expected color and headers",
  async (theme, color) => {
    const response = GET(
      new Request(`https://margin.example/icon?theme=${theme}`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Cache-Control")).toContain("must-revalidate");
    const svg = await response.text();
    expect(svg).toContain(`fill="${color}"`);
    expect(svg).toContain(brandMonogramPath);
    expect(svg.split(brandCornerPath)).toHaveLength(3);
    expect(svg).not.toMatch(/<text|<circle|<image|<script/);
  },
);

it("uses both palette colors for the adaptive shortcut icon", async () => {
  const response = GET(new Request("https://margin.example/icon"));
  const svg = await response.text();
  expect(svg).toContain('fill="#454D24"');
  expect(svg).toContain("@media(prefers-color-scheme:dark)");
  expect(svg).toContain("#B9C65A");
});
