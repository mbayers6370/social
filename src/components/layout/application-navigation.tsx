import Link from "next/link";
import type { ReactNode } from "react";
import { Home, Spaces, Message } from "@/components/margin-icons";
import { BrandLink } from "@/components/shared/brand-link";
import { cn } from "@/lib/utils";
export type ApplicationView = "feed" | "spaces" | "messages" | "profile";
/** Shared presentation. Identity, search and notifications belong to each caller's data boundary. */
export function ApplicationNavigation({
  active,
  live = false,
  headerActions,
  mobileProfile,
  messagingEnabled = true,
}: {
  active?: ApplicationView;
  live?: boolean;
  headerActions: ReactNode;
  mobileProfile: ReactNode;
  messagingEnabled?: boolean;
}) {
  const destinations = [
    { name: "Feed", view: "feed", href: live ? "/app/feed" : "/", Icon: Home },
    {
      name: "Spaces",
      view: "spaces",
      href: live ? "/app/spaces" : "/preview/spaces",
      Icon: Spaces,
    },
    {
      name: "Messages",
      view: "messages",
      href: live ? "/app/messages" : "/?view=messages",
      Icon: Message,
    },
  ].filter(
    (destination) => destination.view !== "messages" || messagingEnabled,
  );
  return (
    <>
      <header className="margin-header margin-topbar margin-navigation-theme">
        <div className="margin-header-inner">
          <BrandLink
            href={live ? "/app/feed" : "/"}
            label="margin feed"
            animate
          />
          <nav aria-label="Primary" className="margin-desktop-nav">
            {destinations.map(({ name, view, href }) => (
              <Link
                prefetch={live ? false : undefined}
                key={view}
                href={href}
                aria-current={active === view ? "page" : undefined}
                className={cn(
                  "margin-nav-item",
                  active === view && "margin-nav-current",
                )}
              >
                {name}
              </Link>
            ))}
          </nav>
          <div className="margin-header-actions">{headerActions}</div>
        </div>
      </header>
      <nav
        aria-label="Mobile navigation"
        className="margin-mobile-nav margin-navigation-theme"
        data-messaging={messagingEnabled}
      >
        {destinations.map(({ name, view, href, Icon }) => (
          <Link
            prefetch={live ? false : undefined}
            key={view}
            href={href}
            aria-current={active === view ? "page" : undefined}
            className="margin-bottom-item"
          >
            <span className="margin-bottom-icon" aria-hidden="true">
              <Icon />
            </span>
            <span>{name}</span>
          </Link>
        ))}
        <Link
          prefetch={live ? false : undefined}
          href={live ? "/app" : "/?view=profile"}
          aria-current={active === "profile" ? "page" : undefined}
          className="margin-bottom-item"
        >
          <span className="margin-bottom-icon" aria-hidden="true">
            {mobileProfile}
          </span>
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
