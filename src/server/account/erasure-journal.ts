import "server-only";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getPrivateStorage } from "@/server/storage";
import { isLocalReviewConfiguration } from "@/lib/local-review";
import { parseErasureReceipt, type ErasureReceipt } from "./erasure-receipts";

export interface ErasureJournal {
  write(receipt: ErasureReceipt): Promise<void>;
  read(key: string): Promise<ErasureReceipt>;
  list(after?: string): Promise<{ keys: string[]; hasMore: boolean }>;
  delete(key: string): Promise<void>;
}
export const erasureReceiptKey = (userId: string) => `erasure/${userId}.json`;
function filename(key: string) {
  if (!/^erasure\/[A-Za-z0-9_-]{1,128}\.json$/.test(key))
    throw Error("Invalid erasure receipt key");
  return key.slice("erasure/".length);
}
function local() {
  if (process.env.MARGIN_LOCAL_PHOTO_STORE !== "1") return false;
  if (
    process.env.NODE_ENV !== "development" &&
    !isLocalReviewConfiguration(process.env)
  )
    throw Error("Local erasure journal is development-only");
  return true;
}
// These paths are private runtime state, never inputs to a deployment artifact.
// The tracing annotations intentionally keep local receipts out of production bundles.
async function localFiles() {
  const fs = await import("node:fs/promises");
  const { resolve, join } = await import("node:path");
  const directory = resolve(
    process.cwd(),
    ".local/private-photos/account-erasure-journal",
  );
  await fs.mkdir(/*turbopackIgnore: true*/ directory, {
    recursive: true,
    mode: 0o700,
  });
  return { fs, directory, join };
}

/** Independent of DB snapshots; private erasure/ prefix is never included in
 * photograph inventory cleanup or public URLs. No request/receipt data is logged. */
export const privateErasureJournal: ErasureJournal = {
  async write(value) {
    const receipt = parseErasureReceipt(value);
    const key = erasureReceiptKey(receipt.userId);
    const body = JSON.stringify(receipt);
    if (local()) {
      const { fs, directory, join } = await localFiles();
      const target = join(/*turbopackIgnore: true*/ directory, filename(key));
      if (!receipt.completedAt) {
        try {
          await fs.writeFile(/*turbopackIgnore: true*/ target, body, {
            mode: 0o600,
            flag: "wx",
          });
        } catch (error) {
          if (!(
            error instanceof Error &&
            "code" in error &&
            error.code === "EEXIST"
          ))
            throw error;
          await privateErasureJournal.read(key);
        }
      } else {
        const staged = `${target}.${randomUUID()}.pending`;
        try {
          await fs.writeFile(/*turbopackIgnore: true*/ staged, body, {
            mode: 0o600,
            flag: "wx",
          });
          await fs.rename(/*turbopackIgnore: true*/ staged, target);
        } finally {
          await fs.rm(/*turbopackIgnore: true*/ staged, { force: true });
        }
      }
      return;
    }
    const { client, bucket } = getPrivateStorage();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: "application/json",
          CacheControl: "private, no-store",
          // A delayed request/worker retry must never overwrite a completed receipt
          // with a pending copy containing the now-deleted Clerk identity.
          ...(!receipt.completedAt ? { IfNoneMatch: "*" } : {}),
        }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
    } catch (error) {
      if (
        receipt.completedAt ||
        !(
          typeof error === "object" &&
          error !== null &&
          "$metadata" in error &&
          typeof error.$metadata === "object" &&
          error.$metadata !== null &&
          "httpStatusCode" in error.$metadata &&
          error.$metadata.httpStatusCode === 412
        )
      )
        throw error;
      await privateErasureJournal.read(key);
    }
  },
  async read(key) {
    const name = filename(key);
    let body: string;
    if (local()) {
      const { fs, directory, join } = await localFiles();
      const file = join(/*turbopackIgnore: true*/ directory, name);
      if ((await fs.stat(/*turbopackIgnore: true*/ file)).size > 16_384)
        throw Error("Invalid erasure receipt size");
      body = await fs.readFile(/*turbopackIgnore: true*/ file, "utf8");
    } else {
      const { client, bucket } = getPrivateStorage();
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(10_000) },
      );
      if (
        !result.Body ||
        !result.ContentLength ||
        result.ContentLength > 16_384
      )
        throw Error("Invalid erasure receipt size");
      body = await result.Body.transformToString();
    }
    const receipt = parseErasureReceipt(JSON.parse(body));
    if (key !== erasureReceiptKey(receipt.userId))
      throw Error("Erasure receipt identity mismatch");
    return receipt;
  },
  async list(after) {
    if (after) filename(after);
    if (local()) {
      const { fs, directory } = await localFiles();
      const keys = (await fs.readdir(/*turbopackIgnore: true*/ directory))
        .filter((name) => /^[A-Za-z0-9_-]{1,128}\.json$/.test(name))
        .map((name) => `erasure/${name}`)
        .filter((key) => !after || key > after)
        .sort();
      return { keys: keys.slice(0, 100), hasMore: keys.length > 100 };
    }
    const { client, bucket } = getPrivateStorage();
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "erasure/",
        StartAfter: after,
        MaxKeys: 100,
      }),
      { abortSignal: AbortSignal.timeout(10_000) },
    );
    const keys = (result.Contents ?? []).map((entry) => {
      if (!entry.Key) throw Error("Invalid journal listing");
      filename(entry.Key);
      return entry.Key;
    });
    return { keys, hasMore: Boolean(result.IsTruncated) };
  },
  async delete(key) {
    const name = filename(key);
    if (local()) {
      const { fs, directory, join } = await localFiles();
      await fs.rm(
        /*turbopackIgnore: true*/ join(
          /*turbopackIgnore: true*/ directory,
          name,
        ),
        {
          force: true,
        },
      );
      return;
    }
    const { client, bucket } = getPrivateStorage();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(10_000),
    });
  },
};
