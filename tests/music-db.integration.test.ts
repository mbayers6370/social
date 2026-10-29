// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { catalogue } from "@/server/music/catalogue";
import {
  changeMusic,
  localMusicDb,
  readMusic,
} from "@/server/music/selections";
import type { ProfileTrack } from "@/features/profile/schema";
let cleanupClient: ReturnType<typeof localMusicDb> | undefined;
afterAll(async () => {
  await cleanupClient?.$disconnect();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe.skipIf(process.env.RUN_LOCAL_DB_TESTS !== "1")(
  "isolated local PostgreSQL music persistence",
  () => {
    it("persists references, serializes concurrent replacements, scopes ownership, and enforces least privilege", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const db = localMusicDb();
      cleanupClient = db;
      const owner = `local-preview:test-${crypto.randomUUID()}`;
      const other = `local-preview:test-${crypto.randomUUID()}`;
      const song = (id: string): ProfileTrack => ({
        id,
        title: "A song",
        artist: "An artist",
        source: "itunes",
        appleMusicUrl: `https://music.apple.com/us/album/song/999?i=${id.slice(7)}`,
        spotifyUrl: "https://open.spotify.com/search/A%20song",
      });
      vi.spyOn(catalogue, "lookup").mockImplementation(async (id) => song(id));
      try {
        await changeMusic({ action: "add", trackId: "itunes-123" }, owner);
        expect((await readMusic(owner)).map((track) => track.id)).toEqual([
          "itunes-123",
        ]);
        const results = await Promise.allSettled(
          ["124", "125", "126"].map((id) =>
            changeMusic({ action: "add", trackId: `itunes-${id}` }, owner),
          ),
        );
        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(3);
        expect(await readMusic(owner)).toHaveLength(1);
        expect(await readMusic(other)).toEqual([]);
        await changeMusic({ action: "remove", trackId: "itunes-123" }, other);
        expect(await readMusic(owner)).toHaveLength(1);
        await expect(
          changeMusic(
            { action: "remove", trackId: "itunes-123", ownerId: owner },
            other,
          ),
        ).rejects.toMatchObject({ status: 400 });
        const permissions = await db.$queryRaw<
          Array<{
            create_schema: boolean;
            migration_write: boolean;
            superuser: boolean;
          }>
        >`SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS create_schema, has_table_privilege(current_user, '"_prisma_migrations"', 'UPDATE') AS migration_write, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`;
        expect(permissions[0]).toEqual({
          create_schema: false,
          migration_write: false,
          superuser: false,
        });
        const user = await db.user.findUniqueOrThrow({
          where: { clerkId: owner },
        });
        await expect(
          db.profileSong.create({
            data: {
              userId: user.id,
              position: 1,
              providerTrackId: "itunes-999",
              title: "No slot",
              artist: "Sample",
              appleUrl: song("itunes-999").appleMusicUrl!,
              spotifyUrl: song("itunes-999").spotifyUrl!,
            },
          }),
        ).rejects.toThrow();
      } finally {
        await db.user.deleteMany({
          where: { clerkId: { in: [owner, other] } },
        });
      }
    });
    it.skipIf(process.env.RUN_LIVE_MUSIC_TEST !== "1")(
      "searches Apple's real catalogue and round-trips a selection through local PostgreSQL",
      async () => {
        vi.stubEnv("NODE_ENV", "development");
        const db = localMusicDb();
        cleanupClient = db;
        const owner = `local-preview:test-live-${crypto.randomUUID()}`;
        try {
          const tracks = await catalogue.search("Anchor Novo Amor");
          const track = tracks.find(
            (item) => item.title === "Anchor" && item.artist === "Novo Amor",
          );
          expect(track).toBeDefined();
          await changeMusic({ action: "add", trackId: track!.id }, owner);
          expect(await readMusic(owner)).toEqual([track]);
          await changeMusic({ action: "remove", trackId: track!.id }, owner);
          expect(await readMusic(owner)).toEqual([]);
        } finally {
          await db.user.deleteMany({ where: { clerkId: owner } });
        }
      },
    );
  },
);
