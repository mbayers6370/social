import "server-only";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { MemberService } from "@/server/member/service";
import type { PrivatePhotoStore } from "@/server/social/photo";
import {
  synchronizeInvitations,
  type InvitationProvider,
} from "@/server/account/invitation-provider";
import { reconcilePhotoObjects } from "./photo-orphans";

export const MAINTENANCE_INTERVAL_MS = 60_000;
export const MAINTENANCE_JOBS = [
  "invitations",
  "messages",
  "posts",
  "spaces",
  "photos",
] as const;
type JobName = (typeof MAINTENANCE_JOBS)[number];
type Counts = Record<string, number>;

/** One atomic expiring lease per job, shared by workers on every host. A failed
 * job leaves its last success unchanged; only aggregate counts are persisted. */
export async function runLeasedJob(
  db: PrismaClient,
  name: JobName,
  run: (signal: AbortSignal, leaseOwner: string) => Promise<Counts>,
  now = new Date(),
) {
  const token = randomUUID();
  const leaseUntil = new Date(now.getTime() + 180_000);
  const claimed = await db.$queryRaw<{ name: string }[]>`
    INSERT INTO "MaintenanceJob" (name, "leaseOwner", "leaseUntil", "lastStartedAt")
    VALUES (${name}, ${token}, ${leaseUntil}, ${now})
    ON CONFLICT (name) DO UPDATE SET "leaseOwner" = ${token},
      "leaseUntil" = ${leaseUntil}, "lastStartedAt" = ${now}
    WHERE "MaintenanceJob"."leaseUntil" IS NULL OR "MaintenanceJob"."leaseUntil" <= ${now}
    RETURNING name`;
  if (!claimed.length) return { name, status: "busy" as const };
  const signal = AbortSignal.timeout(45_000);
  try {
    const counts = await run(signal, token);
    const limit = name === "messages" ? 100 : 20;
    counts.backlog = Number(
      (counts.checked ?? counts.erased ?? 0) >=
        (name === "photos" ? 100 : limit) ||
        (counts.purged ?? 0) >= 20 ||
        (counts.orphaned ?? 0) >= 100 ||
        (counts.notifications ?? 0) >= 100 ||
        (counts.retired ?? 0) >= 100 ||
        (counts.usageErased ?? 0) >= 100,
    );
    if (signal.aborted) throw Error("Maintenance time budget exhausted");
    const completed = await db.maintenanceJob.updateMany({
      where: { name, leaseOwner: token },
      data: {
        leaseOwner: null,
        leaseUntil: null,
        lastSucceededAt: new Date(),
        failures: 0,
        result: counts as Prisma.InputJsonObject,
      },
    });
    if (completed.count !== 1) throw Error("Maintenance lease lost");
    return { name, status: "completed" as const, counts };
  } catch {
    await db.maintenanceJob.updateMany({
      where: { name, leaseOwner: token },
      data: {
        leaseOwner: null,
        leaseUntil: null,
        lastFailedAt: new Date(),
        failures: { increment: 1 },
      },
    });
    return { name, status: "failed" as const };
  }
}

export async function runMaintenanceCycle(
  db: PrismaClient,
  store: PrivatePhotoStore,
  provider: Pick<InvitationProvider, "find" | "revoke">,
) {
  const service = new MemberService(db, store);
  const work: Record<
    JobName,
    (signal: AbortSignal, leaseOwner: string) => Promise<Counts>
  > = {
    invitations: async (signal) => ({
      checked: await synchronizeInvitations(db, provider, new Date(), {
        limit: 20,
        signal,
      }),
    }),
    messages: async () => {
      const counts = await service.expireMessages(100);
      return { erased: counts.messages, notifications: counts.notifications };
    },
    posts: async (signal) => ({
      erased: await service.expirePosts(20, signal),
      usageErased: await service.erasePostingUsage(100),
    }),
    spaces: async (signal) => ({
      erased: await service.expireSpaces(20, signal),
    }),
    photos: async (signal, leaseOwner) => {
      const retired = await service.retireOrphanedPhotos(100);
      let purged = 0;
      let failed = false;
      try {
        purged = await service.purgeDeletedPhotos(20, signal);
      } catch {
        failed = true;
      }
      const erased = await service.erasePurgedPhotoRecords(100);
      const inventory = await reconcilePhotoObjects(
        db,
        store,
        signal,
        leaseOwner,
      );
      if (failed) throw Error("Photo deletion needs retry");
      return { retired, purged, erased, ...inventory };
    },
  };
  // A Clerk/storage outage must never prevent database content erasure.
  return Promise.all(
    MAINTENANCE_JOBS.map(async (name) => {
      try {
        return await runLeasedJob(db, name, work[name]);
      } catch {
        return { name, status: "failed" as const };
      }
    }),
  );
}

export async function maintenanceHealth(db: PrismaClient, now = new Date()) {
  const rows = await db.maintenanceJob.findMany({
    select: { name: true, lastSucceededAt: true, failures: true, result: true },
  });
  return MAINTENANCE_JOBS.map((name) => {
    const row = rows.find((row) => row.name === name);
    return {
      name,
      healthy: Boolean(
        row?.lastSucceededAt &&
        now.getTime() - row.lastSucceededAt.getTime() < 180_000 &&
        row.failures === 0 &&
        (row.result as Counts | null)?.backlog !== 1,
      ),
      lastSucceededAt: row?.lastSucceededAt ?? null,
      failures: row?.failures ?? 0,
      counts: row?.result ?? null,
    };
  });
}
