import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { getDb } from "@/server/db";
import { privatePhotoStore } from "@/server/social/photo";
import { SocialError } from "@/server/social/errors";
import { MemberService } from "@/server/member/service";
export async function memberPage<T>(
  load: (service: MemberService, subject: string) => Promise<T>,
  area = "Spaces",
) {
  if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1") notFound();
  const subject = await requireUser();
  try {
    await enforceRateLimit("read", subject);
    return {
      data: await load(new MemberService(getDb(), privatePhotoStore), subject),
      error: null,
    };
  } catch (error) {
    if (error instanceof SocialError && error.status === 404) notFound();
    return {
      data: null,
      error:
        error instanceof SocialError && error.status === 403
          ? "Your account needs activation before you can continue."
          : `${area} could not be loaded. Please try again.`,
    };
  }
}
