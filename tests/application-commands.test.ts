import { afterEach, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertFreshBuild,
  claimServerPort,
  recordBuild,
  serverPort,
  sourceFingerprint,
} from "../scripts/application-runtime.mjs";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "margin-app-command-"));
  directories.push(root);
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "public"));
  mkdirSync(join(root, ".next"));
  writeFileSync(join(root, "src/post.css"), "body { color: olive; }");
  writeFileSync(join(root, ".next/BUILD_ID"), "build-one");
  return root;
}
it.each(["src/post.css", "public/post.woff2", ".env.local"])(
  "rejects a production build after changing %s",
  (file) => {
    const root = fixture();
    recordBuild(root, join(root, ".next"), sourceFingerprint(root));
    expect(() => assertFreshBuild(root, join(root, ".next"))).not.toThrow();
    writeFileSync(join(root, file), "changed content");
    expect(() => assertFreshBuild(root, join(root, ".next"))).toThrow(
      "out of date",
    );
  },
);
it("does not treat generated reports, instructions or working-tree Git state as application changes", () => {
  const root = fixture();
  const before = sourceFingerprint(root);
  writeFileSync(join(root, "AGENTS.md"), "Instructions");
  writeFileSync(join(root, ".next/report.json"), "{}");
  mkdirSync(join(root, "src/generated"));
  writeFileSync(join(root, "src/generated/client.ts"), "generated");
  expect(sourceFingerprint(root)).toBe(before);
});
it("rejects missing receipts, replaced builds and source changes during compilation", () => {
  const root = fixture();
  const directory = join(root, ".next");
  expect(() => assertFreshBuild(root, directory)).toThrow(
    "no valid current-source record",
  );
  const fingerprint = sourceFingerprint(root);
  recordBuild(root, directory, fingerprint);
  writeFileSync(join(directory, "BUILD_ID"), "unverified-build");
  expect(() => assertFreshBuild(root, directory)).toThrow(
    "no valid current-source record",
  );
  writeFileSync(join(root, "src/post.css"), "changed mid-build");
  expect(() => recordBuild(root, directory, fingerprint)).toThrow(
    "Source changed during the build",
  );
});
it("preserves Next port argument precedence and rejects invalid ports", () => {
  expect(serverPort([], "4567")).toBe(4567);
  expect(serverPort(["--hostname", "localhost", "-p", "3210"], "4567")).toBe(
    3210,
  );
  expect(serverPort(["--port=4321"])).toBe(4321);
  for (const value of ["0", "-1", "65536", "wrong", "3e3"])
    expect(() => serverPort(["--port", value])).toThrow("valid TCP port");
});
it.each(["127.0.0.1", "::1"])(
  "refuses an existing %s listener and removes its unsuccessful lease",
  async (host) => {
    const root = fixture();
    const server = createServer((socket) => socket.end());
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, host, resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw Error("Expected TCP listener");
    try {
      await expect(
        claimServerPort(address.port, { directory: root }),
      ).rejects.toThrow("already in use");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(
      readdirSync(root).some((name) => name.startsWith("margin-server-")),
    ).toBe(false);
  },
);
it("serializes concurrent commands and recovers a lease left by a dead process", async () => {
  const root = fixture();
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw Error("Expected TCP listener");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const results = await Promise.allSettled([
    claimServerPort(port, { directory: root }),
    claimServerPort(port, { directory: root }),
  ]);
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);
  for (const result of results)
    if (result.status === "fulfilled") result.value();
  const file = join(
    root,
    `margin-server-${process.getuid?.() ?? "user"}-${port}.json`,
  );
  writeFileSync(file, JSON.stringify({ pid: 2147483647, token: "dead" }));
  const release = await claimServerPort(port, { directory: root });
  release();
  release();
  expect(
    readdirSync(root).some((name) => name.startsWith("margin-server-")),
  ).toBe(false);
});
it("builds a receipt through the actual command and refuses to launch a stale production server", () => {
  const root = fixture();
  writeFileSync(join(root, "package.json"), '{"type":"module"}');
  const cli = join(root, "node_modules/next/dist/bin");
  mkdirSync(cli, { recursive: true });
  writeFileSync(
    join(cli, "next"),
    `import { writeFileSync } from 'node:fs'; if(process.argv.includes('--help')) process.exit(0); if(process.argv[2]==='build') writeFileSync('.next/BUILD_ID','compiled-build'); else writeFileSync('server-started','yes');`,
  );
  const command = resolve("scripts/application.mjs");
  const build = spawnSync(process.execPath, [command, "build"], {
    cwd: root,
    encoding: "utf8",
  });
  expect(build.status, build.stderr).toBe(0);
  expect(
    JSON.parse(readFileSync(join(root, ".next/margin-source.json"), "utf8"))
      .buildId,
  ).toBe("compiled-build");
  writeFileSync(join(root, "src/post.css"), "body { color: lime; }");
  const help = spawnSync(process.execPath, [command, "build", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  expect(help.status).toBe(0);
  expect(() => assertFreshBuild(root, join(root, ".next"))).toThrow(
    "out of date",
  );
  // Port 0 is intentionally invalid, so use a high port and a controlled lease directory
  // through TMPDIR; no Next server is launched after the freshness denial.
  const start = spawnSync(
    process.execPath,
    [command, "start", "--port", "63991"],
    {
      cwd: root,
      env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root },
      encoding: "utf8",
    },
  );
  expect(start.status).toBe(1);
  expect(start.stderr).toContain("out of date");
  expect(readdirSync(root)).not.toContain("server-started");
});
