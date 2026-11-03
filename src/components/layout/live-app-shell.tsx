"use client";
import type { ReactNode } from "react";
import { Avatar } from "@/features/feed/post-content";
import { Profile } from "@/components/margin-icons";
import { MemberSearch } from "@/features/social/member-search";
import { MemberNotifications } from "@/features/social/member-notifications";
import { useMember } from "@/features/social/member-provider";
import { LiveProfileMenu } from "./profile-menu";

import {
  ApplicationNavigation,
  type ApplicationView,
} from "./application-navigation";
import { AppFooter } from "./app-footer";
export function LiveAppShell({
  active,
  children,
  viewer,
}: {
  active: ApplicationView;
  children: ReactNode;
  viewer?: { id: string; name: string };
}) {
  return (
    <div className="margin-app">
      <LiveAppNavigation active={active} viewer={viewer} />
      <main id="main-content" tabIndex={-1} className="margin-main">
        {children}
      </main>
      <AppFooter desktop />
    </div>
  );
}

/** Public documents reuse the member header without installing a second app shell. */
export function LiveAppNavigation({
  active,
  viewer,
}: {
  active?: ApplicationView;
  viewer?: { id: string; name: string };
}) {
  const member = useMember();
  const person =
    member?.identity.person ??
    (viewer
      ? {
          ...viewer,
          initials: viewer.name
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
          tone: "paper" as const,
        }
      : null);
  const avatar = person ? (
    <Avatar person={person} live />
  ) : (
    <Profile aria-hidden="true" />
  );
  return (
    <ApplicationNavigation
      live
      active={active}
      messagingEnabled={member?.identity.preferences.messagingEnabled === true}
      mobileProfile={
        person ? (
          <Avatar live small person={person} sizes="20px" />
        ) : (
          <Profile />
        )
      }
      headerActions={
        <>
          <MemberSearch />
          <MemberNotifications />
          <LiveProfileMenu avatar={avatar} />
        </>
      }
    />
  );
}
