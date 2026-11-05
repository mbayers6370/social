import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer as createHttpsServer } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import {
  assertFreshBuild,
  claimServerPort,
  recordBuild,
  sourceFingerprint,
} from "./application-runtime.mjs";
import {
  isLocalReviewConfiguration,
  localReviewBuildDirectory,
} from "../src/lib/local-review.ts";

const root = process.cwd();
const reviewDirectory = join(root, ".local", "local-review");
const reviewBuildDirectory = join(root, localReviewBuildDirectory);
const arguments_ = process.argv.slice(2);
const buildOnly = arguments_.includes("--build-only");
const localhost = arguments_.includes("--localhost");
if (
  arguments_.some(
    (argument) => !["--build-only", "--localhost"].includes(argument),
  )
)
  throw new Error("Usage: npm run review -- [--localhost] [--build-only]");
if (!existsSync(join(root, "package.json")))
  throw new Error("Run the local review from the Margin repository root.");

loadEnvFile(join(root, ".env"));

function privateAddress() {
  const configured = process.env.MARGIN_REVIEW_HOST?.trim();
  if (configured) return configured;
  for (const entries of Object.values(networkInterfaces()))
    for (const entry of entries ?? [])
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(entry.address)
      )
        return entry.address;
  throw new Error(
    "No private LAN address was found. Set MARGIN_REVIEW_HOST to this Mac's private IP.",
  );
}

const host = localhost ? "localhost" : privateAddress();
if (!localhost && !isIP(host))
  throw new Error("MARGIN_REVIEW_HOST must be a private IPv4 address.");
const publicPort = Number(process.env.MARGIN_REVIEW_PORT || 3000);
if (!Number.isInteger(publicPort) || publicPort < 1024 || publicPort > 65535)
  throw new Error("MARGIN_REVIEW_PORT must be an unprivileged TCP port.");
const publicUrl = `${localhost ? "http" : "https"}://${host}:${publicPort}`;
const environment = {
  ...process.env,
  NODE_ENV: "production",
  MARGIN_LOCAL_REVIEW: "1",
  MARGIN_LOCAL_PHOTO_STORE: "1",
  NEXT_PUBLIC_APP_URL: publicUrl,
  NEXT_PUBLIC_SENTRY_DSN: "",
  SENTRY_AUTH_TOKEN: "",
};
if (!isLocalReviewConfiguration(environment))
  throw new Error(
    "Local review requires matching Clerk test keys and the margin_runtime user on the loopback margin_local database.",
  );

const nextCli = join(root, "node_modules", "next", "dist", "bin", "next");
// Claim both address families before replacing any build assets.
const releasePort = await claimServerPort(publicPort);
process.once("exit", releasePort);
const fingerprint = sourceFingerprint(root);
rmSync(reviewBuildDirectory, { recursive: true, force: true });
process.stdout.write(
  "Building the current source for local production review…\n",
);
const build = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: root,
  env: environment,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
recordBuild(root, reviewBuildDirectory, fingerprint);
if (buildOnly) {
  process.stdout.write(
    `Current local review build is ready for ${publicUrl}.\n`,
  );
  process.exit(0);
}

const tlsDirectory = join(reviewDirectory, "tls");
let tls;
if (!localhost) {
  rmSync(tlsDirectory, { recursive: true, force: true });
  mkdirSync(tlsDirectory, { recursive: true, mode: 0o700 });
  const key = join(tlsDirectory, "key.pem");
  const certificate = join(tlsDirectory, "certificate.pem");
  const openssl = spawnSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "7",
      "-keyout",
      key,
      "-out",
      certificate,
      "-subj",
      "/CN=Margin local review",
      "-addext",
      `subjectAltName=IP:${host},IP:127.0.0.1,DNS:localhost`,
    ],
    { stdio: "ignore" },
  );
  if (openssl.status !== 0)
    throw new Error(
      "OpenSSL is required to create the local HTTPS certificate.",
    );
  tls = { key: readFileSync(key), cert: readFileSync(certificate) };
}

Object.assign(process.env, environment);
const createNext = (await import("next")).default;
const application = createNext({
  dev: false,
  dir: root,
  hostname: host,
  port: publicPort,
});
await application.prepare();
const handle = application.getRequestHandler();
const handleRequest = async (request, response) => {
  // A production review is a snapshot. Never silently serve old document HTML
  // after a CSS, font, source or configuration edit.
  if (request.headers.accept?.includes("text/html")) {
    try {
      assertFreshBuild(
        root,
        reviewBuildDirectory,
        `npm run review${localhost ? " -- --localhost" : ""}`,
      );
    } catch {
      response.writeHead(503, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(
        `The local review is out of date because source or configuration changed. Stop this server and run npm run review${localhost ? " -- --localhost" : ""}, then reload this page. Your account data has not been reset.`,
      );
      return;
    }
  }
  try {
    await handle(request, response);
  } catch {
    if (!response.headersSent) response.writeHead(500);
    response.end("Local review server error");
  }
};
const server = tls
  ? createHttpsServer(tls, handleRequest)
  : createHttpServer(handleRequest);

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections();
  process.exitCode = code;
  // Next may retain background handles. A stopped server must release its
  // process lease so the next review can start on the same port.
  const deadline = setTimeout(() => process.exit(code), 5000);
  deadline.unref();
  void Promise.all([
    new Promise((resolve) => server.close(resolve)),
    application.close(),
  ]).then(
    () => process.exit(code),
    () => process.exit(code || 1),
  );
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
server.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  stop(1);
});
server.listen(publicPort, localhost ? "localhost" : "0.0.0.0", () => {
  process.stdout.write(
    `\nMargin local production review: ${publicUrl}\n${localhost ? "Clerk sign-in uses your existing local account. This server is accessible only on this Mac." : "Use this same address on the Mac and phone."} Press Ctrl-C to stop it.\n`,
  );
});
