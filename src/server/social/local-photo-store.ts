import "server-only";
import {
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
  readdir,
  stat,
} from "node:fs/promises";
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
    async list(after, limit = 100) {
      let names: string[];
      try {
        names = await readdir(join(root, "social"));
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return { objects: [], hasMore: false };
        throw error;
      }
      const keys = names
        .map((name) => `social/${name}`)
        .filter(
          (key) =>
            /^social\/[a-f0-9-]{36}\.webp$/.test(key) &&
            (!after || key > after),
        )
        .sort();
      const batch = Math.min(100, Math.max(1, limit));
      return {
        objects: await Promise.all(
          keys.slice(0, batch).map(async (key) => ({
            key,
            lastModified: (await stat(path(key))).mtime,
          })),
        ),
        hasMore: keys.length > batch,
      };
    },
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
