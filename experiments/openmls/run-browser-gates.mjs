import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium, firefox, webkit } from "@playwright/test";

const root = resolve(import.meta.dirname);
const local = resolve(root, "../../.local/openmls-feasibility");
const chromiumPath = chromium.executablePath();
// Firefox/WebKit were installed into this prototype's ignored folder.
const isolatedExecutable = (type) =>
  join(
    local,
    "browsers",
    type
      .executablePath()
      .replace(/^.*\/(firefox-\d+\/.*|webkit-\d+\/.*)$/, "$1"),
  );
const server = createServer(async (request, response) => {
  // Fixed allowlist: no arbitrary filesystem access or fixture state endpoint.
  const paths = new Map([
    ["/", ["index.html", "text/html"]],
    [
      "/pkg/margin_openmls_feasibility.js",
      ["pkg/margin_openmls_feasibility.js", "text/javascript"],
    ],
    [
      "/pkg/margin_openmls_feasibility_bg.wasm",
      ["pkg/margin_openmls_feasibility_bg.wasm", "application/wasm"],
    ],
  ]);
  const entry = paths.get(request.url);
  if (!entry) {
    response.writeHead(404).end();
    return;
  }
  try {
    response.writeHead(200, {
      "Content-Type": entry[1],
      "Cache-Control": "no-store",
    });
    response.end(await readFile(join(root, entry[0])));
  } catch {
    response.writeHead(503).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browsers = [];
const results = [];
const call = (page, method, argument) =>
  page.evaluate(
    async ({ method, argument }) => window.lab.call(method, argument),
    { method, argument },
  );
const rejected = async (promise) => {
  try {
    await promise;
    return false;
  } catch {
    return true;
  }
};
async function gate(name, run) {
  try {
    await run();
    results.push({ name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch {
    results.push({ name, status: "failed" });
    console.error(`FAIL ${name}`);
    throw new Error(`Gate failed: ${name}`);
  }
}
async function reload(page) {
  await page.reload();
  await page.evaluate(() => window.ready);
}
try {
  for (const [type, options] of [
    [chromium, { executablePath: chromiumPath }],
    [firefox, { executablePath: isolatedExecutable(firefox) }],
    [webkit, { executablePath: isolatedExecutable(webkit) }],
  ]) {
    const browser = await type.launch({ headless: true, ...options });
    browsers.push(browser);
  }
  const pages = await Promise.all(
    browsers.map(async (browser) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(origin);
      await page.evaluate(() => window.ready);
      return page;
    }),
  );
  const [alice, bob, carol] = pages;
  await Promise.all(
    pages.map((page, i) =>
      page.evaluate(
        (name) => window.lab.create(name),
        ["alice-desktop", "bob-firefox", "alice-second-device"][i],
      ),
    ),
  );
  let initialMessage;
  await gate(
    "Chromium to Firefox: join and bidirectional application messages",
    async () => {
      await call(alice, "create_group");
      const added = await call(alice, "add", await call(bob, "key_package"));
      await call(bob, "join", added.welcome);
      initialMessage = await call(
        alice,
        "send",
        "synthetic hello from chromium",
      );
      assert.equal(
        Buffer.from(initialMessage).includes(Buffer.from("synthetic hello")),
        false,
      );
      assert.equal(
        await call(bob, "receive", initialMessage),
        "synthetic hello from chromium",
      );
      assert.equal(
        await call(
          alice,
          "receive",
          await call(bob, "send", "synthetic reply from firefox"),
        ),
        "synthetic reply from firefox",
      );
    },
  );
  await gate(
    "Saved-state recovery: reload both active sender and receiver from IndexedDB",
    async () => {
      await reload(alice);
      await reload(bob);
      assert.equal(
        await call(bob, "receive", await call(alice, "send", "after reload")),
        "after reload",
      );
      assert.equal(
        await call(
          alice,
          "receive",
          await call(bob, "send", "after receiver reload"),
        ),
        "after receiver reload",
      );
      assert.equal(await rejected(call(bob, "receive", initialMessage)), true);
    },
  );
  await gate(
    "WebKit third device: join, cross-engine commit processing and messages",
    async () => {
      const added = await call(alice, "add", await call(carol, "key_package"));
      await call(bob, "receive", added.commit);
      await call(carol, "join", added.welcome);
      const message = await call(carol, "send", "hello from webkit");
      assert.equal(await call(alice, "receive", message), "hello from webkit");
      assert.equal(await call(bob, "receive", message), "hello from webkit");
      assert.equal(
        await rejected(call(carol, "receive", initialMessage)),
        true,
      );
    },
  );
  await gate(
    "Device removal: remaining device works; removed device cannot decrypt next epoch",
    async () => {
      const removal = await call(alice, "remove", "bob-firefox");
      await call(carol, "receive", removal);
      // Bob deliberately withholds the removal commit and retains all old secrets.
      const message = await call(alice, "send", "after removal");
      assert.equal(await call(carol, "receive", message), "after removal");
      assert.equal(await rejected(call(bob, "receive", message)), true);
      await call(bob, "receive", removal);
      assert.equal(await rejected(call(bob, "send", "removed sender")), true);
      await reload(bob);
      assert.equal(
        await rejected(call(bob, "send", "removed after reload")),
        true,
      );
    },
  );
  await gate("Ciphertext tampering and replay are rejected", async () => {
    const message = await call(carol, "send", "tamper fixture");
    const changed = [...message];
    changed[changed.length - 1] ^= 1;
    assert.equal(await rejected(call(alice, "receive", changed)), true);
    assert.equal(await call(alice, "receive", message), "tamper fixture");
    assert.equal(await rejected(call(alice, "receive", message)), true);
  });
  await gate(
    "Failed durable write freezes sender before releasing ciphertext",
    async () => {
      await carol.evaluate(() => window.lab.failStorage());
      assert.equal(await rejected(call(carol, "send", "never released")), true);
      assert.equal(await rejected(call(carol, "send", "still frozen")), true);
    },
  );
  await gate("Corrupt saved state fails closed on reload", async () => {
    await alice.evaluate(() => window.lab.corruptState());
    await alice.reload();
    assert.equal(await rejected(alice.evaluate(() => window.ready)), true);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  const hash = async (path) =>
    createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
  await mkdir(join(local, "results"), { recursive: true, mode: 0o700 });
  await writeFile(
    join(local, "results/browser-gates.json"),
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        status:
          results.length === 7 &&
          results.every((result) => result.status === "passed")
            ? "passed"
            : "failed",
        lockfileSha256: await hash(join(root, "Cargo.lock")),
        wasmSha256: await hash(
          join(root, "pkg/margin_openmls_feasibility_bg.wasm"),
        ),
        prototype: "OpenMLS 0.9.2 / RustCrypto 0.6.0",
        browsers: browsers.map((browser, i) => ({
          engine: ["Chromium", "Firefox", "WebKit"][i],
          version: browser.version(),
        })),
        results,
        scope:
          "Synthetic trusted identities; plaintext test snapshots; no production integration, native-device or encrypted-backup evidence",
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await Promise.all(browsers.map((browser) => browser.close()));
  await new Promise((resolve) => server.close(resolve));
}
