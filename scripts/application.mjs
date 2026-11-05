import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  assertFreshBuild,
  claimServerPort,
  recordBuild,
  serverPort,
  sourceFingerprint,
} from "./application-runtime.mjs";

const [mode, ...args] = process.argv.slice(2);
const root = process.cwd();
const cli = join(root, "node_modules/next/dist/bin/next");
try {
  if (!["build", "dev", "start"].includes(mode))
    throw Error("Choose build, dev or start.");
  if (
    args.some((argument) =>
      ["--help", "-h", "--version", "-v"].includes(argument),
    )
  ) {
    const result = spawnSync(process.execPath, [cli, mode, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    process.exitCode = result.status ?? 1;
  } else if (mode === "build") {
    const fingerprint = sourceFingerprint(root);
    const result = spawnSync(process.execPath, [cli, mode, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
    else recordBuild(root, join(root, ".next"), fingerprint);
  } else {
    if (mode === "start") assertFreshBuild(root, join(root, ".next"));
    const release = await claimServerPort(serverPort(args));
    process.once("exit", release);
    const child = spawn(process.execPath, [cli, mode, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    let stopping = false;
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => {
        if (stopping) return;
        stopping = true;
        child.kill(signal);
        const deadline = setTimeout(() => child.kill("SIGKILL"), 5000);
        deadline.unref();
      });
    child.once("error", () => {
      process.stderr.write("Could not start Next.js.\n");
      process.exitCode = 1;
    });
    child.once("exit", (code, signal) => {
      process.exitCode =
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
    });
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
