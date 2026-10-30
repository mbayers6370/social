import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error("Could not inspect the repository before pushing.");
  return result.stdout.trim();
}
try {
  const head = git("rev-parse", "HEAD");
  const changes = readFileSync(0, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(/\s+/));
  const updates = changes.filter(([, oid]) => !/^0+$/.test(oid));
  if (updates.length) {
    if (git("status", "--porcelain"))
      throw new Error(
        "Commit or stash your changes before pushing so the tested files match the pushed commit.",
      );
    for (const [, oid] of updates)
      if (git("rev-parse", `${oid}^{commit}`) !== head)
        throw new Error(
          "Check out the commit being pushed and push one tested branch at a time.",
        );
    const result = spawnSync(process.execPath, ["scripts/verify.mjs"], {
      stdio: "inherit",
    });
    if (result.status !== 0)
      throw new Error("Push stopped because verification failed.");
    if (git("rev-parse", "HEAD") !== head || git("status", "--porcelain"))
      throw new Error(
        "Files changed during verification. Review and run the push again.",
      );
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
