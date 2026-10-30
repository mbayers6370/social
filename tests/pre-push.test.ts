// @vitest-environment node
import { expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const head = "1".repeat(40);
function probe({
  dirty = false,
  codeOnly = false,
  fail = false,
  differentCommit = false,
  deletion = false,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "margin-push-guard-"));
  try {
    mkdirSync(join(root, "bin"));
    mkdirSync(join(root, "scripts"));
    writeFileSync(
      join(root, "scripts/pre-push.mjs"),
      readFileSync(new URL("../scripts/pre-push.mjs", import.meta.url)),
    );
    writeFileSync(
      join(root, "bin/git"),
      `#!/bin/sh\nif [ "$1" = "status" ]; then\n  if [ "$MARGIN_PROBE_DIRTY" = "1" ]; then echo " M example.ts"; fi\nelif [ "$2" = "HEAD" ]; then\n  echo "${head}"\nelse\n  echo "$MARGIN_PROBE_COMMIT"\nfi\n`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(root, "scripts/verify.mjs"),
      "import { writeFileSync } from 'node:fs'; writeFileSync('verification.json', JSON.stringify(process.argv.slice(2))); process.exitCode = Number(process.env.MARGIN_PROBE_FAIL);\n",
    );
    const oid = deletion
      ? "0".repeat(40)
      : differentCommit
        ? "2".repeat(40)
        : head;
    const result = spawnSync(process.execPath, ["scripts/pre-push.mjs"], {
      cwd: root,
      encoding: "utf8",
      input: `refs/heads/main ${oid} refs/heads/main ${"3".repeat(40)}\n`,
      env: {
        ...process.env,
        PATH: `${join(root, "bin")}:${process.env.PATH}`,
        MARGIN_VERIFY_CODE_ONLY: codeOnly ? "1" : "",
        MARGIN_PROBE_DIRTY: dirty ? "1" : "",
        MARGIN_PROBE_COMMIT: oid,
        MARGIN_PROBE_FAIL: fail ? "1" : "0",
      },
    });
    return {
      status: result.status,
      error: result.stderr,
      verificationArgs: existsSync(join(root, "verification.json"))
        ? JSON.parse(readFileSync(join(root, "verification.json"), "utf8"))
        : null,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
it("always requests full verification, including when the former code-only push flag is set", () => {
  expect(probe({ codeOnly: true })).toMatchObject({
    status: 0,
    verificationArgs: [],
  });
});
it("stops a push if verification fails", () => {
  const result = probe({ fail: true });
  expect(result.status).toBe(1);
  expect(result.error).toContain("verification failed");
});
it("rejects uncommitted changes before invoking verification", () => {
  const result = probe({ dirty: true });
  expect(result).toMatchObject({ status: 1, verificationArgs: null });
  expect(result.error).toContain("Commit or stash");
});
it("rejects a different pushed commit than the checked-out HEAD", () => {
  const result = probe({ differentCommit: true });
  expect(result).toMatchObject({ status: 1, verificationArgs: null });
  expect(result.error).toContain("Check out the commit");
});
it("does not run application verification for a branch deletion", () => {
  expect(probe({ deletion: true })).toMatchObject({
    status: 0,
    verificationArgs: null,
  });
});
