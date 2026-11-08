import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { isolatedEnvironment, localTestPort } from "./testing/environment.mjs";
import {
  claimServerPort,
  serverPort,
  sourceFingerprint,
} from "./application-runtime.mjs";

const root = process.cwd();
const project = path.join(root, "portfolio");
const output = path.join(project, "out");
const mode = process.argv[2];
const env = isolatedEnvironment(
  process.env,
  readFileSync(".env.example", "utf8"),
);
// Never inherit client build credentials or integrations, even if the caller has them configured.
for (const name of Object.keys(env))
  if (name.startsWith("NEXT_PUBLIC_") || name.startsWith("MARGIN_"))
    delete env[name];
env.NEXT_TELEMETRY_DISABLED = "1";
env.NODE_ENV = "production";
const receiptPath = path.join(project, ".next", "demo-source.json");
function fingerprint() {
  const hash = createHash("sha256").update(sourceFingerprint(root));
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (
        [
          ".next",
          "out",
          "public",
          "next-env.d.ts",
          "AGENTS.md",
          "tsconfig.tsbuildinfo",
          ".demo-owner.json",
        ].includes(entry.name)
      )
        continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile())
        hash.update(path.relative(project, file)).update(readFileSync(file));
    }
  }
  visit(project);
  hash.update(readFileSync("scripts/public-demo.mjs"));
  return hash.digest("hex");
}
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw Error(`Demo command failed (${result.status ?? result.error}).`);
}
// One build/serve lease prevents changing static assets underneath a running review server.
function lease() {
  const file = path.join(project, ".demo-owner.json");
  const token = randomUUID();
  const busy = () =>
    Error(
      "Stop the existing demo build/server before rebuilding or serving its output.",
    );
  mkdirSync(path.dirname(file), { recursive: true });
  if (existsSync(file)) {
    const previous = readFileSync(file, "utf8");
    const owner = JSON.parse(previous);
    if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw busy();
    try {
      process.kill(owner.pid, 0);
      throw busy();
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
      if (readFileSync(file, "utf8") !== previous) throw busy();
      unlinkSync(file);
    }
  }
  let fd;
  try {
    fd = openSync(file, "wx", 0o600);
  } catch {
    throw busy();
  }
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, token }));
  } finally {
    closeSync(fd);
  }
  return () => {
    if (
      existsSync(file) &&
      JSON.parse(readFileSync(file, "utf8")).token === token
    )
      unlinkSync(file);
  };
}
function checkBuild() {
  if (
    !existsSync(receiptPath) ||
    readFileSync(receiptPath, "utf8").trim() !== fingerprint()
  )
    throw Error(
      "Static output is missing or stale. Run npm run demo:build first.",
    );
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml",
};
async function serve(port) {
  const releasePort = await claimServerPort(port);
  process.once("exit", releasePort);
  const headerRules = [];
  let currentRule;
  for (const line of readFileSync(path.join(output, "_headers"), "utf8").split(
    "\n",
  )) {
    if (line.startsWith("/")) {
      currentRule = { path: line, headers: {} };
      headerRules.push(currentRule);
    } else if (line.startsWith("  ") && currentRule) {
      const colon = line.indexOf(":");
      currentRule.headers[line.slice(2, colon)] = line.slice(colon + 1).trim();
    }
  }
  const server = createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400);
      res.end("Invalid URL.");
      return;
    }
    for (const rule of headerRules)
      if (
        rule.path === pathname ||
        (rule.path.endsWith("*") && pathname.startsWith(rule.path.slice(0, -1)))
      ) {
        for (const [name, value] of Object.entries(rule.headers))
          res.setHeader(name, value);
      }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Static demo: backend operations are unavailable.");
      return;
    }
    let file = path.resolve(output, "." + pathname);
    if (file !== output && !file.startsWith(output + path.sep))
      file = path.join(output, "index.html");
    if (pathname.endsWith("/")) file = path.join(file, "index.html");
    else if (!path.extname(file)) file = path.join(file, "index.html");
    let status = 200;
    if (!existsSync(file)) {
      file = path.join(output, "404.html");
      status = 404;
    }
    res.writeHead(status, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return async () => {
    await new Promise((resolve) => server.close(resolve));
    releasePort();
  };
}

async function preparePublicAssets() {
  // Explicit public asset allowlist. Never copy .env, private files or the full repository.
  const assets = [
    "brands/spotify.svg",
    "brands/apple-music.svg",
    "brands/photo-open-cursor.svg",
    "fonts/NotoSans-Regular.ttf",
    "fonts/OFL.txt",
    "fonts/inter/OFL.txt",
  ];
  const publicDir = path.join(project, "public");
  rmSync(publicDir, { recursive: true, force: true });
  for (const asset of assets) {
    const dest = path.join(publicDir, asset);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(root, "public", asset), dest);
  }
  const sharp = (await import("sharp")).default;
  await sharp(
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f2f0ea"/><text x="80" y="155" font-family="Arial,sans-serif" font-size="48" fill="#454d24">margin</text><text x="80" y="330" font-family="Arial,sans-serif" font-size="76" fill="#30383d">A feed that ends.</text><text x="80" y="430" font-family="Arial,sans-serif" font-size="76" fill="#454d24">Imagine.</text><text x="80" y="550" font-family="Arial,sans-serif" font-size="28" fill="#30383d">An interactive portfolio concept · Fictional accounts</text></svg>',
    ),
  )
    .png()
    .toFile(path.join(publicDir, "social-card.png"));
}

let release;
try {
  if (!["dev", "build", "serve", "test"].includes(mode))
    throw Error("Choose dev, build, serve or test.");
  release = lease();
  process.once("exit", release);
  if (mode !== "dev")
    for (const signal of ["SIGINT", "SIGTERM"])
      process.on(signal, () => process.exit(signal === "SIGINT" ? 130 : 143));
  // Next must never load a portfolio .env file containing application credentials.
  if (mode === "dev" || mode === "build") {
    for (const name of [
      ".env",
      ".env.local",
      ".env.production",
      ".env.production.local",
      ".env.development",
      ".env.development.local",
    ])
      if (existsSync(path.join(project, name)))
        throw Error(
          `Remove ${name} from the portfolio project before running it. This target must not load service configuration.`,
        );
  }
  if (mode === "dev") {
    const args = process.argv.slice(3);
    const releasePort = await claimServerPort(serverPort(args));
    process.once("exit", releasePort);
    run(["scripts/check-local-storage.mjs"]);
    await preparePublicAssets();
    env.NODE_ENV = "development";
    const child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "dev",
        "portfolio",
        "--webpack",
        ...args,
      ],
      { cwd: root, env, stdio: "inherit" },
    );
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
      console.error("Could not start the portfolio development server.");
      process.exitCode = 1;
    });
    child.once("exit", (code, signal) => {
      process.exitCode =
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
    });
  } else if (mode === "build") {
    run(["scripts/check-local-storage.mjs"]);
    await preparePublicAssets();
    const before = fingerprint();
    run(["node_modules/next/dist/bin/next", "build", "portfolio", "--webpack"]);
    // CSP script hashes are computed from exported HTML, never a reused request nonce.
    const hashes = new Set();
    const documents = new Map();
    function scan(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (
          !entry.isFile() ||
          /(?:^\.env(?:\.|$)|\.(?:map|pem|key|p12|pfx|p8)$)/.test(entry.name)
        )
          throw Error(
            `Unexpected private or non-static export file: ${path.relative(output, file)}`,
          );
        else if (
          /\.(?:html|js|css|json|txt|xml|svg)$/.test(entry.name) &&
          /(?:\b(?:pk|sk)_(?:test|live)_[A-Za-z0-9]{12,}|postgres(?:ql)?:\/\/|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
            readFileSync(file, "utf8"),
          )
        )
          throw Error(
            `Credential-shaped content found in static output: ${path.relative(output, file)}`,
          );
        if (entry.isFile() && entry.name.endsWith(".html")) {
          const html = readFileSync(file, "utf8");
          documents.set(file, html);
          for (const match of html.matchAll(
            /<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi,
          ))
            if (match[1])
              hashes.add(
                `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`,
              );
        }
      }
    }
    scan(output);
    // Every exported public information link must have a real destination and anchor.
    for (const [file, html] of documents) {
      for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
        const relative = path
          .relative(output, file)
          .split(path.sep)
          .join("/")
          .replace(/index\.html$/, "");
        const url = new URL(
          match[1].replaceAll("&amp;", "&"),
          `https://demo.invalid/${relative}`,
        );
        if (url.origin !== "https://demo.invalid") continue;
        let destination = path.join(output, decodeURIComponent(url.pathname));
        if (!path.extname(destination))
          destination = path.join(destination, "index.html");
        if (!existsSync(destination))
          throw Error(`Missing exported link in ${relative}: ${match[1]}`);
        if (
          url.hash &&
          documents.has(destination) &&
          !documents
            .get(destination)
            .includes(`id="${decodeURIComponent(url.hash.slice(1))}"`)
        )
          throw Error(`Missing exported anchor in ${relative}: ${match[1]}`);
      }
    }
    writeFileSync(
      path.join(output, "_headers"),
      `/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; script-src 'self' ${[...hashes].join(" ")}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; media-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'\n/demo/*\n  X-Robots-Tag: noindex, noarchive, nosnippet\n`,
    );
    // A real 404.html prevents Cloudflare Pages' automatic SPA fallback for /api or /app.
    if (!existsSync(path.join(output, "404.html")))
      throw Error("The static deployment must include an explicit 404 page.");
    if (fingerprint() !== before)
      throw Error("Source changed while exporting. Rebuild the demo.");
    writeFileSync(receiptPath, before + "\n");
    run(["scripts/check-local-storage.mjs"]);
    console.log(
      "Static demo ready: portfolio/out (Cloudflare Pages; no Functions).",
    );
  } else {
    checkBuild();
    const port =
      mode === "test"
        ? await localTestPort()
        : serverPort(process.argv.slice(3), "3000");
    const stop = await serve(port);
    console.log(`Static demo: http://127.0.0.1:${port}`);
    if (mode === "test") {
      try {
        const { spawn } = await import("node:child_process");
        const child = spawn(
          process.execPath,
          [
            "node_modules/@playwright/test/cli.js",
            "test",
            "--config",
            "portfolio/playwright.config.ts",
          ],
          {
            env: { ...env, DEMO_TEST_URL: `http://127.0.0.1:${port}` },
            stdio: "inherit",
          },
        );
        const code = await new Promise((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", resolve);
        });
        if (code !== 0) throw Error(`Static demo tests failed (${code}).`);
      } finally {
        await stop();
      }
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
