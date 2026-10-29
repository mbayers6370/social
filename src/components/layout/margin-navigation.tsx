"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AvatarFrame,
  avatarImageStyle,
} from "@/components/shared/avatar-frame";
import { usePreview } from "@/features/local-preview/provider";
import type { Person } from "@/features/feed/schema";
import { cn } from "@/lib/utils";
import { House, Mail, UserRound } from "lucide-react";
import { ProfileSearch } from "@/features/search/profile-search";
import { NotificationCenter } from "@/features/notifications/notification-center";
import { BrandLink } from "@/components/shared/brand-link";
import { ProfileMenu } from "./profile-menu";

export type MarginView = "feed" | "messages" | "profile";
const destinations = [
  { name: "Feed", view: "feed", href: "/", Icon: House },
  {
    name: "Messages",
    view: "messages",
    href: "/?view=messages",
    Icon: Mail,
  },
] as const;

export function MarginNavigation({
  active = "feed",
  profileAvatar,
}: {
  active?: MarginView;
  profileAvatar: ReactNode;
}) {
  return (
    <>
      <header className="margin-header margin-topbar margin-navigation-theme">
        <div className="margin-header-inner">
          <BrandLink label="margin feed" animate />
          <nav aria-label="Primary" className="margin-desktop-nav">
            {destinations.map(({ name, view, href }) => (
              <Link
                key={view}
                className={cn(
                  "margin-nav-item",
                  active === view && "margin-nav-current",
                )}
                href={href}
                aria-current={active === view ? "page" : undefined}
              >
                {name}
              </Link>
            ))}
          </nav>
          <div className="margin-header-actions">
            <ProfileSearch />
            <NotificationCenter placement="header" />
            <ProfileMenu avatar={profileAvatar} />
          </div>
        </div>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="margin-mobile-nav margin-navigation-theme"
      >
        {destinations.map(({ name, view, href, Icon }) => (
          <Link
            key={view}
            href={href}
            aria-current={active === view ? "page" : undefined}
            className="margin-bottom-item"
          >
            <span className="margin-bottom-icon" aria-hidden="true">
              <Icon strokeWidth={1.5} />
            </span>
            <span>{name}</span>
          </Link>
        ))}
        <Link
          href="/?view=profile"
          aria-current={active === "profile" ? "page" : undefined}
          className="margin-bottom-item"
        >
          <span className="margin-bottom-icon" aria-hidden="true">
            <MobileProfileAvatar />
          </span>
          <span>Profile</span>
        </Link>
      </nav>
    </>
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
        <UserRound strokeWidth={1.5} />
      )}
    </AvatarFrame>
  );
}
