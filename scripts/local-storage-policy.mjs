import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { basename, join, relative } from "node:path";

export const maxLocalBytes = 2 * 1024 * 1024 * 1024;
export const retainedVerificationReports = 3;

const allowedTopLevel = new Set([
  "auth-activation",
  "database.json",
  "local-review",
  "postgres",
  "postgres.log",
  "private-photos",
  "socket",
  "tools",
  "verification",
]);
const allowedReviewEntries = new Set(["next", "tls"]);

function allocatedBytes(stat) {
  return Number.isFinite(stat.blocks) ? stat.blocks * 512 : stat.size;
}

export function inspectLocalStorage(root, { byteLimit = maxLocalBytes } = {}) {
  const local = join(root, ".local");
  if (!existsSync(local)) return { bytes: 0, violations: [] };

  const violations = [];
  for (const entry of readdirSync(local))
    if (!allowedTopLevel.has(entry))
      violations.push(`Unexpected .local entry: ${entry}`);

  const review = join(local, "local-review");
  if (existsSync(review))
    for (const entry of readdirSync(review))
      if (!allowedReviewEntries.has(entry))
        violations.push(`Unexpected local-review entry: ${entry}`);

  const verification = join(local, "verification");
  if (existsSync(verification)) {
    const reports = readdirSync(verification).filter((entry) =>
      /^run-[A-Za-z0-9_-]+$/.test(entry),
    );
    if (reports.length > retainedVerificationReports)
      violations.push(
        `Verification retains ${reports.length} reports; maximum is ${retainedVerificationReports}`,
      );
    for (const entry of readdirSync(verification))
      if (!reports.includes(entry))
        violations.push(`Unexpected verification entry: ${entry}`);
  }

  let bytes = 0;
  const pending = [local];
  while (pending.length) {
    const current = pending.pop();
    const stat = lstatSync(current);
    bytes += allocatedBytes(stat);
    if (current !== local && basename(current) === ".git") {
      violations.push(
        `Nested Git repository or worktree: ${relative(local, current)}`,
      );
      continue;
    }
    if (stat.isDirectory() && !stat.isSymbolicLink())
      for (const entry of readdirSync(current))
        pending.push(join(current, entry));
  }
  if (bytes > byteLimit)
    violations.push(
      `.local uses ${formatBytes(bytes)}; maximum is ${formatBytes(byteLimit)}`,
    );
  return { bytes, violations: [...new Set(violations)] };
}

export function pruneVerificationReports(
  root,
  keep = retainedVerificationReports,
) {
  const verification = join(root, ".local", "verification");
  if (!existsSync(verification)) return [];
  const reports = readdirSync(verification)
    .filter((entry) => /^run-[A-Za-z0-9_-]+$/.test(entry))
    .map((entry) => ({
      entry,
      modified: lstatSync(join(verification, entry)).mtimeMs,
    }))
    .sort((left, right) => right.modified - left.modified);
  const removed = reports.slice(keep).map(({ entry }) => entry);
  for (const entry of removed)
    rmSync(join(verification, entry), { recursive: true, force: true });
  return removed;
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KiB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${Math.ceil(bytes / (1024 * 1024))} MiB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}
