import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { PrivatePhotoStore } from "@/server/social/photo";

/** Reconcile bytes left by a dead uploader with no surviving DB intent. The
 * private cursor advances after each examined key, even if deletion fails, so
 * one bad object cannot starve the rest of the scan. Every scan wraps around. */
export async function reconcilePhotoObjects(
  db: PrismaClient,
  store: PrivatePhotoStore,
  signal: AbortSignal,
  leaseOwner: string,
) {
  if (signal.aborted) throw Error("Object scan time budget exhausted");
  if (!store.list) throw Error("Private object inventory is unavailable");
  const job = await db.maintenanceJob.findUniqueOrThrow({
    where: { name: "photos" },
    select: { objectCursor: true },
  });
  const page = await store.list(job.objectCursor ?? undefined, 100);
  let cursor = job.objectCursor;
  let examined = 0;
  let orphaned = 0;
  let failed = false;
  const cutoff = Date.now() - 600_000;
  for (const object of page.objects) {
    if (signal.aborted) break;
    cursor = object.key;
    examined++;
    if (
      !/^social\/[a-f0-9-]{36}\.webp$/.test(object.key) ||
      object.lastModified.getTime() > cutoff
    )
      continue;
    const record = await db.photo.findUnique({
      where: { objectKey: object.key },
      select: { id: true },
    });
    if (record) continue;
    try {
      await store.delete(object.key);
      orphaned++;
    } catch {
      failed = true;
    }
  }
  const complete = examined === page.objects.length && !page.hasMore;
  await db.maintenanceJob.updateMany({
    where: { name: "photos", leaseOwner },
    data: { objectCursor: complete ? null : cursor },
  });
  if (failed) throw Error("Orphaned object cleanup needs retry");
  return { examined, orphaned, scanComplete: Number(complete) };
}
