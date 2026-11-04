// Test-only HTTPS termination. Keep the application's CSP and HSTS intact:
// WebKit correctly upgrades HTTP links/assets in the production build.
import { createServer } from "node:https";
import { request } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localTestPort } from "./environment.mjs";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("An unprivileged local test port is required");
const certificates = mkdtempSync(join(tmpdir(), "margin-test-tls-"));
const key = join(certificates, "key.pem");
const cert = join(certificates, "cert.pem");
process.on("exit", () =>
  rmSync(certificates, { recursive: true, force: true }),
);
const generated = spawnSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-keyout",
    key,
    "-out",
    cert,
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ],
  { stdio: "ignore" },
);
if (generated.status !== 0)
  throw new Error(
    "OpenSSL is required for local production browser verification",
  );

let backendPort;
do {
  backendPort = await localTestPort();
} while (backendPort === port);
const backend = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(backendPort),
  ],
  { stdio: "inherit", env: process.env },
);
const server = createServer(
  { key: readFileSync(key), cert: readFileSync(cert) },
  (incoming, outgoing) => {
    const upstream = request(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        path: incoming.url,
        method: incoming.method,
        headers: { ...incoming.headers, "x-forwarded-proto": "https" },
      },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.on("error", () => outgoing.destroy());
        response.pipe(outgoing);
      },
    );
    upstream.on("error", () => {
      if (!outgoing.destroyed) {
        if (!outgoing.headersSent) outgoing.writeHead(503);
        outgoing.end();
      }
    });
    incoming.on("aborted", () => upstream.destroy());
    outgoing.on("close", () => upstream.destroy());
    incoming.pipe(upstream);
  },
);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  server.closeAllConnections();
  server.close();
  backend.kill("SIGTERM");
}
backend.once("error", () => stop(1));
backend.once("exit", (code) => {
  if (!stopping) stop(code || 1);
});
server.on("error", () => stop(1));
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
server.listen(port, "127.0.0.1");
