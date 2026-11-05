import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { privatePhotoStore } from "@/server/social/photo";
import { ModerationService } from "@/server/safety/service";
import { ModerationQueue } from "@/features/safety/moderation-queue";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { SocialError } from "@/server/social/errors";

export default async function Page() {
  if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1") notFound();
  const subject = await requireUser();
  await enforceRateLimit("read", subject);
  const data = await new ModerationService(getDb(), privatePhotoStore)
    .reports(subject)
    .catch((error) => {
      if (error instanceof SocialError && error.status === 403) notFound();
      throw error;
    });
  return (
    <ModerationQueue
      initial={data.reports.map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        review: report.review
          ? {
              ...report.review,
              createdAt: report.review.createdAt.toISOString(),
            }
          : null,
      }))}
      initialCursor={data.nextCursor}
    />
  );
}
