import { readFileSync, writeFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";

const [mode, option, value, extra] = process.argv.slice(2);
if (mode === "--help") {
  console.log(
    "Private operator commands: request --subject <verified-clerk-subject>; export-receipts --output <absolute-private-file>; import-receipts --input <absolute-private-file>; restore-journal (no further arguments). Requires Node 22 and MARGIN_ERASURE_OPERATOR=1. Do not log or commit receipt files. Keep the site offline during restoration; import the latest independent journal before maintenance and reopening traffic.",
  );
  process.exit(0);
}
if (
  Number(process.versions.node.split(".")[0]) !== 22 ||
  process.env.MARGIN_ERASURE_OPERATOR !== "1"
)
  throw Error(
    "Use Node 22 and explicitly enable the reviewed erasure operator environment.",
  );
if (
  extra ||
  (mode === "restore-journal"
    ? Boolean(option || value)
    : !value ||
      !["request", "export-receipts", "import-receipts"].includes(mode) ||
      option !==
        {
          request: "--subject",
          "export-receipts": "--output",
          "import-receipts": "--input",
        }[mode])
)
  throw Error("Choose an erasure operator command; use --help.");
if (["export-receipts", "import-receipts"].includes(mode) && !isAbsolute(value))
  throw Error("Choose an absolute private receipt path.");
if (mode === "request" && !/^[A-Za-z0-9_-]{1,128}$/.test(value))
  throw Error("Invalid verified subject.");
const { getDb } = await import("../src/server/db.ts");
const db = getDb();
try {
  if (mode === "request") {
    const { AccountErasureService } =
      await import("../src/server/account/erasure.ts");
    const { privatePhotoStore } = await import("../src/server/social/photo.ts");
    await new AccountErasureService(db, privatePhotoStore).request(value);
    console.log(
      "Erasure request recorded if a matching account exists. Check aggregate maintenance health; no identity was logged.",
    );
  } else {
    const { exportErasureReceipts, importErasureReceipts } =
      await import("../src/server/account/erasure-receipts.ts");
    if (mode === "restore-journal") {
      const { privateErasureJournal } =
        await import("../src/server/account/erasure-journal.ts");
      let after;
      let imported = 0;
      for (;;) {
        const page = await privateErasureJournal.list(after);
        for (const key of page.keys)
          imported += await importErasureReceipts(db, {
            version: 1,
            receipts: [await privateErasureJournal.read(key)],
          });
        if (!page.hasMore) break;
        const next = page.keys.at(-1);
        if (!next || (after && next <= after))
          throw Error("Journal pagination did not advance");
        after = next;
      }
      console.log(JSON.stringify({ imported }));
    } else if (mode === "export-receipts") {
      const data = await exportErasureReceipts(db);
      writeFileSync(value, JSON.stringify(data), { mode: 0o600, flag: "wx" });
      console.log(JSON.stringify({ exported: data.receipts.length }));
    } else {
      const file = statSync(value);
      if (!file.isFile() || file.size > 20 * 1024 * 1024)
        throw Error("Invalid or oversized receipt file.");
      console.log(
        JSON.stringify({
          imported: await importErasureReceipts(
            db,
            JSON.parse(readFileSync(value, "utf8")),
          ),
        }),
      );
    }
  }
} catch {
  console.error(
    "Erasure operation failed. Check the intended environment and private input; no private data was logged.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
