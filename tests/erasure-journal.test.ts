import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
const storage = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/server/storage", () => ({
  getPrivateStorage: () => ({ client: storage, bucket: "private-fixture" }),
}));
import { privateErasureJournal } from "@/server/account/erasure-journal";
const objects = new Map<string, string>();
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARGIN_LOCAL_PHOTO_STORE", "");
  objects.clear();
  storage.send.mockImplementation(
    async (
      command:
        | PutObjectCommand
        | GetObjectCommand
        | DeleteObjectCommand
        | ListObjectsV2Command,
    ) => {
      const key = "Key" in command.input ? command.input.Key! : "";
      if (command instanceof PutObjectCommand) {
        if (command.input.IfNoneMatch === "*" && objects.has(key))
          throw { $metadata: { httpStatusCode: 412 } };
        objects.set(key, String(command.input.Body));
        return {};
      }
      if (command instanceof GetObjectCommand)
        return {
          ContentLength: objects.get(key)!.length,
          Body: { transformToString: async () => objects.get(key)! },
        };
      if (command instanceof DeleteObjectCommand) {
        objects.delete(key);
        return {};
      }
      return {
        Contents: [...objects.keys()].map((Key) => ({ Key })),
        IsTruncated: false,
      };
    },
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
const pending = {
  userId: "account-fixture",
  clerkId: "user_fixture",
  requestedAt: "2026-11-05T12:00:00.000Z",
  completedAt: null,
  providerDeletedAt: null,
};
it("keeps the journal private and prevents a delayed pending write from reviving a cleared Clerk reference", async () => {
  await privateErasureJournal.write(pending);
  await privateErasureJournal.write({
    ...pending,
    clerkId: null,
    providerDeletedAt: pending.requestedAt,
    completedAt: pending.requestedAt,
  });
  await privateErasureJournal.write(pending);
  expect(
    (await privateErasureJournal.read("erasure/account-fixture.json")).clerkId,
  ).toBeNull();
  const command = storage.send.mock.calls[0][0] as PutObjectCommand;
  expect(command.input).toMatchObject({
    IfNoneMatch: "*",
    ContentType: "application/json",
    CacheControl: "private, no-store",
  });
  expect((await privateErasureJournal.list()).keys).toEqual([
    "erasure/account-fixture.json",
  ]);
  await privateErasureJournal.delete("erasure/account-fixture.json");
  expect(objects.size).toBe(0);
});
it("fails closed on storage errors, malformed receipts and mismatched object identities", async () => {
  storage.send.mockRejectedValueOnce(Error("storage offline"));
  await expect(privateErasureJournal.write(pending)).rejects.toThrow();
  await expect(privateErasureJournal.read("../photo.webp")).rejects.toThrow();
  objects.set("erasure/other-account.json", JSON.stringify(pending));
  await expect(
    privateErasureJournal.read("erasure/other-account.json"),
  ).rejects.toThrow("identity mismatch");
});
