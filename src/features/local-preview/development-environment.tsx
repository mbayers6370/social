import "server-only";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

export async function DevelopmentEnvironment({
  children,
}: {
  children: ReactNode;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { PreviewProvider } = await import("@/features/local-preview/provider");
  const { getDevelopmentSocial } = await import("@/server/fixtures/social");
  const { loadDevelopmentFriendProfile } =
    await import("@/server/fixtures/friend-profile-action");
  const { SpacesPreviewProvider } =
    await import("@/features/spaces/preview-provider");
  const { getDevelopmentSpaces } = await import("@/server/fixtures/spaces");
  const bootstrap = getDevelopmentSocial();
  bootstrap.profiles = bootstrap.profiles.map((profile) =>
    profile.person.id === bootstrap.viewerId
      ? { ...profile, onRepeat: [] }
      : profile,
  );
  if (process.env.DATABASE_URL) {
    const { readMusic } = await import("@/server/music/selections");
    try {
      const onRepeat = await readMusic();
      bootstrap.profiles = bootstrap.profiles.map((profile) =>
        profile.person.id === bootstrap.viewerId
          ? { ...profile, onRepeat }
          : profile,
      );
    } catch {
      /* A database outage must not take down the local shell. Saves fail closed. */
    }
  }
  return (
    <PreviewProvider
      bootstrap={bootstrap}
      loadFriendProfileAction={loadDevelopmentFriendProfile}
    >
      <SpacesPreviewProvider bootstrap={getDevelopmentSpaces(bootstrap.now)}>
        {children}
      </SpacesPreviewProvider>
    </PreviewProvider>
  );
}
