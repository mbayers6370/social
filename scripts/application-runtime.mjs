import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  unlinkSync,
  openSync,
  closeSync,
} from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const configuration =
  /^(?:next\.config\.|postcss\.config\.|tailwind\.config\.|package(?:-lock)?\.json$|tsconfig\.json$|\.env(?:\.(?:local|production|production\.local))?$)/;
export function sourceFingerprint(root) {
  const hash = createHash("sha256");
  function visit(file) {
    const name = relative(root, file);
    if (name === "src/generated" || name.endsWith(".DS_Store")) return;
    const entries = readdirSync(file, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const child = join(file, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile()) add(child);
      else throw Error("Runtime source must not contain symbolic links");
    }
  }
  function add(file) {
    hash.update(relative(root, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  for (const directory of ["src", "public"])
    if (existsSync(join(root, directory))) visit(join(root, directory));
  for (const name of readdirSync(root)
    .filter((name) => configuration.test(name))
    .sort())
    add(join(root, name));
  for (const name of [
    "prisma/schema.prisma",
    "scripts/application.mjs",
    "scripts/application-runtime.mjs",
    "scripts/local-review.mjs",
  ])
    if (existsSync(join(root, name))) add(join(root, name));
  return hash.digest("hex");
}

export function recordBuild(root, directory, fingerprint) {
  if (sourceFingerprint(root) !== fingerprint)
    throw Error(
      "Source changed during the build. Rebuild before starting the server.",
    );
  const buildId = readFileSync(join(directory, "BUILD_ID"), "utf8").trim();
  writeFileSync(
    join(directory, "margin-source.json"),
    JSON.stringify({ version: 1, fingerprint, buildId }) + "\n",
  );
}

export function assertFreshBuild(root, directory, command = "npm run build") {
  let receipt;
  try {
    receipt = JSON.parse(
      readFileSync(join(directory, "margin-source.json"), "utf8"),
    );
    if (
      receipt.version !== 1 ||
      receipt.buildId !==
        readFileSync(join(directory, "BUILD_ID"), "utf8").trim()
    )
      throw Error();
  } catch {
    throw Error(
      `This build has no valid current-source record. Run ${command}.`,
    );
  }
  if (receipt.fingerprint !== sourceFingerprint(root))
    throw Error(
      `This production build is out of date. Source or configuration changed. Run ${command}.`,
    );
}

export function serverPort(args, fallback = process.env.PORT ?? "3000") {
  let value = fallback;
  for (let index = 0; index < args.length; index++) {
    if (["--port", "-p"].includes(args[index])) value = args[++index];
    else if (args[index].startsWith("--port=")) value = args[index].slice(7);
  }
  const port = Number(value);
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw Error("Specify a valid TCP port.");
  return port;
}

async function listening(port, host) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", (error) => {
      socket.destroy();
      if (
        [
          "ECONNREFUSED",
          "EAFNOSUPPORT",
          "ENETUNREACH",
          "EADDRNOTAVAIL",
        ].includes(error.code)
      )
        resolve(false);
      else reject(error);
    });
    socket.setTimeout(500, () => {
      socket.destroy();
      reject(Error(`Cannot verify whether port ${port} is free.`));
    });
  });
}

/** One lease across IPv4/IPv6 and all supported app commands. Never kills another server. */
export async function claimServerPort(port, { directory = tmpdir() } = {}) {
  const file = join(
    directory,
    `margin-server-${process.getuid?.() ?? "user"}-${port}.json`,
  );
  const token = randomUUID();
  const busy = () =>
    Error(
      `Port ${port} is already in use by another server or app command. Stop it first; Margin will not launch a second site or switch ports.`,
    );
  let acquired = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = openSync(file, "wx", 0o600);
      try {
        writeFileSync(handle, JSON.stringify({ pid: process.pid, token }));
      } finally {
        closeSync(handle);
      }
      acquired = true;
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        throw busy();
      }
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw busy();
      try {
        process.kill(owner.pid, 0);
        throw busy();
      } catch (error) {
        if (error.code !== "ESRCH") throw busy();
        // Only remove the dead owner's lease, never a replacement lease.
        if (readFileSync(file, "utf8") !== JSON.stringify(owner)) throw busy();
        unlinkSync(file);
      }
    }
  }
  if (!acquired) throw busy();
  const release = () => {
    try {
      if (JSON.parse(readFileSync(file, "utf8")).token === token)
        unlinkSync(file);
    } catch {
      /* A released lease needs no further cleanup. */
    }
  };
  try {
    if (
      (
        await Promise.all([
          listening(port, "127.0.0.1"),
          listening(port, "::1"),
        ])
      ).some(Boolean)
    )
      throw busy();
    return release;
  } catch (error) {
    release();
    throw error;
  }
}
