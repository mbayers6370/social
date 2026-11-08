"use client";

import { type ReactNode, useState, useEffect } from "react";
import { useAccountSession } from "@/components/auth/account-session-context";
import Image from "next/image";
import {
  AvatarFrame,
  avatarImageStyle,
} from "@/components/shared/avatar-frame";
import { usePreview } from "@/features/local-preview/provider";
import type { Person } from "@/features/feed/schema";
import { Profile } from "@/components/margin-icons";
import { ProfileSearch } from "@/features/search/profile-search";
import { NotificationCenter } from "@/features/notifications/notification-center";
import {
  ApplicationNavigation,
  type ApplicationView,
} from "./application-navigation";
import { ProfileMenu } from "./profile-menu";

export type MarginView = ApplicationView;
export function MarginNavigation({
  active = "feed",
  profileAvatar,
}: {
  active?: MarginView;
  profileAvatar: ReactNode;
}) {
  const session = useAccountSession();
  const enterPreview = session?.enterPreview;
  useEffect(() => {
    enterPreview?.();
  }, [enterPreview]);
  return (
    <ApplicationNavigation
      active={active}
      mobileProfile={<MobileProfileAvatar />}
      headerActions={
        <>
          <ProfileSearch />
          <NotificationCenter placement="header" />
          <ProfileMenu avatar={profileAvatar} />
        </>
      }
    />
  );
}

function MobileProfileAvatar() {
  const { state, bootstrap } = usePreview();
  const photo = state.profiles.find(
    (profile) => profile.person.id === bootstrap.viewerId,
  )?.person.photo;
  return <ProfilePhoto key={photo?.src ?? "fallback"} photo={photo} />;
}
function ProfilePhoto({ photo }: { photo?: Person["photo"] }) {
  const [failed, setFailed] = useState(false);
  return (
    <AvatarFrame className="margin-mobile-profile-photo" size={20}>
      {photo && !failed ? (
        <Image
          src={photo.src}
          alt=""
          fill
          sizes="20px"
          loading="eager"
          style={avatarImageStyle}
          onError={() => setFailed(true)}
        />
      ) : (
        <Profile />
      )}
    </AvatarFrame>
  );
}
