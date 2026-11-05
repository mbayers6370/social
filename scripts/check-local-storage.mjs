import { inspectLocalStorage, formatBytes } from "./local-storage-policy.mjs";

const result = inspectLocalStorage(process.cwd());
if (result.violations.length) {
  process.stderr.write(
    `Local storage policy failed:\n${result.violations.map((violation) => `- ${violation}`).join("\n")}\nRun npm run clean:local for a dry run before removing generated artifacts.\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Local storage policy passed (${formatBytes(result.bytes)}).\n`,
  );
}
