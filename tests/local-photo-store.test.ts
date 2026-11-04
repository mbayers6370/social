// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { localPhotoStore } from "@/server/social/local-photo-store";
import { privatePhotoStore } from "@/server/social/photo";
afterEach(() => vi.unstubAllEnvs());
it("keeps development bytes private, rejects traversal, and handles repeated deletion", async () => {
  const root = await mkdtemp(join(tmpdir(), "margin-private-photo-"));
  try {
    const store = localPhotoStore(root);
    const key = `social/${randomUUID()}.webp`;
    await store.put(key, new Uint8Array([1, 2, 3]));
    expect(await store.get(key)).toEqual(Buffer.from([1, 2, 3]));
    expect((await stat(join(root, key))).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "social"))).mode & 0o777).toBe(0o700);
    const listing = await store.list!();
    expect(listing.objects).toEqual([{ key, lastModified: expect.any(Date) }]);
    expect(await store.list!(key)).toEqual({ objects: [], hasMore: false });
    await expect(store.get("../.env")).rejects.toThrow(
      "Invalid private object key",
    );
    await expect(
      store.put("social/../../outside.webp", new Uint8Array([1])),
    ).rejects.toThrow();
    await store.delete(key);
    await expect(store.delete(key)).resolves.toBeUndefined();
    await expect(store.get(key)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("refuses filesystem storage in production even when its environment flag is set", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARGIN_LOCAL_PHOTO_STORE", "1");
  await expect(
    privatePhotoStore.put("social/test.webp", new Uint8Array([1])),
  ).rejects.toThrow("development-only");
  await expect(privatePhotoStore.get("social/test.webp")).rejects.toThrow(
    "development-only",
  );
  await expect(privatePhotoStore.delete("social/test.webp")).rejects.toThrow(
    "development-only",
  );
});
