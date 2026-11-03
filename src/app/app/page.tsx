import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { SocialService } from "@/server/social/service";
import { privatePhotoStore } from "@/server/social/photo";
import { SocialError } from "@/server/social/errors";
import { enforceRateLimit } from "@/server/security/rate-limit";
import { AuthShell } from "@/features/account/auth-shell";
import { PrivateProfile } from "@/features/social/private-profile";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const querySchema = z
  .object({
    person: id.optional(),
    before: id.optional(),
    post: id.optional(),
    comment: id.optional(),
    edit: z.literal("1").optional(),
  })
  .strict()
  .refine((query) => !query.comment || Boolean(query.post))
  .refine((query) => !query.before || !query.post);
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your Margin",
  robots: { index: false, follow: false },
};

async function loadProfile(
  subject: string,
  query: z.infer<typeof querySchema>,
) {
  try {
    await enforceRateLimit("read", subject);
    const service = new SocialService(getDb(), privatePhotoStore);
    const account = await service.account(subject);
    if (!account || account.accountStatus !== "ACTIVE") {
      return {
        kind: "inactive" as const,
        missing: !account,
        deactivated: account?.accountStatus === "DEACTIVATED",
      };
    }
    return {
      kind: "ready" as const,
      data: await service.profile(
        subject,
        query.person ?? account.id,
        query.before,
        query.post,
      ),
    };
  } catch (error) {
    if (error instanceof SocialError && error.status === 404) notFound();
    return { kind: "unavailable" as const };
  }
}

/** Live identity and server read models only. No preview actors, fixtures or browser persistence. */
export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.MARGIN_PRIVATE_BACKEND_ENABLED !== "1") notFound();
  const subject = await requireUser();
  const query = querySchema.safeParse(await searchParams);
  if (!query.success) notFound();
  const result = await loadProfile(subject, query.data);
  if (result.kind === "unavailable") {
    return (
      <AuthShell
        title="Your posts are unavailable."
        intro="We couldn’t load your account right now. Please try again in a moment."
      >
        <Link className={buttonVariants()} href="/app">
          Try again
        </Link>
      </AuthShell>
    );
  }
  if (result.kind === "inactive") {
    return (
      <AuthShell
        title={
          result.deactivated
            ? "Your account is unavailable."
            : "Your account is waiting."
        }
        intro={
          result.deactivated
            ? "This account no longer has access to Margin."
            : "Your account is waiting for approval. You can return once it’s activated."
        }
      >
        {result.missing && (
          <Link className={buttonVariants()} href="/onboarding">
            Complete your profile
          </Link>
        )}
        <Link href="/welcome">Return to Margin</Link>
      </AuthShell>
    );
  }
  const { data } = result;
  return (
    <PrivateProfile
      key={`${data.viewerId}:${data.profile.id}`}
      data={data}
      conversationTarget={
        query.data.post
          ? { postId: query.data.post, commentId: query.data.comment }
          : undefined
      }
    />
  );
}
