// @vitest-environment node
import { expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function check(css: string) {
  const directory = mkdtempSync(join(tmpdir(), "margin-style-check-"));
  try {
    mkdirSync(join(directory, "src/app"), { recursive: true });
    mkdirSync(join(directory, "src/styles"), { recursive: true });
    writeFileSync(
      join(directory, "src/app/layout.tsx"),
      'import "@/styles/globals.css";\nimport "@/styles/application.css";',
    );
    writeFileSync(join(directory, "src/styles/globals.css"), "");
    writeFileSync(join(directory, "src/styles/application.css"), css);
    return spawnSync(process.execPath, [resolve("scripts/check-styles.mjs")], {
      cwd: directory,
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
it("rejects a later patch even when its first declaration is inside a selector group", () => {
  const result = check(
    ".margin-one, .margin-two { gap: 4px; } .margin-two { gap: 8px; }",
  );
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(".margin-two repeats gap");
});
it("rejects the same patch spread across repeated media blocks", () => {
  expect(
    check(
      "@media (width > 40rem) { .margin-one { gap: 4px; } } @media (width > 40rem) { .margin-one { gap: 8px; } }",
    ).status,
  ).not.toBe(0);
});
it("allows distinct responsive, state, support and keyframe contexts", () => {
  expect(
    check(`
    .margin-one { gap: 4px; }
    .margin-one:hover { gap: 6px; }
    @media (width > 40rem) { .margin-one { gap: 8px; } }
    @supports (display: grid) { .margin-one { gap: 10px; } }
    @keyframes margin-test { from { opacity: 0; } to { opacity: 1; } }
  `).status,
  ).toBe(0);
});
