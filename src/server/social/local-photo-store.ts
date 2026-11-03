import "server-only";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PrivatePhotoStore } from "./photo";

/** Explicit, development-only private storage. Never served from public/ or a
 * bearer URL; the same authenticated media handlers authorize every read. */
export function localPhotoStore(
  root = join(process.cwd(), ".local", "private-photos"),
): PrivatePhotoStore {
  const path = (key: string) => {
    if (!/^social\/[a-f0-9-]{36}\.webp$/.test(key))
      throw Error("Invalid private object key");
    return join(root, key);
  };
  return {
    async put(key, bytes) {
      const target = path(key);
      await mkdir(join(root, "social"), { recursive: true, mode: 0o700 });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
        await rename(temporary, target);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    },
    async get(key) {
      return readFile(path(key));
    },
    async delete(key) {
      try {
        await unlink(path(key));
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ))
          throw error;
      }
    },
  };
}
