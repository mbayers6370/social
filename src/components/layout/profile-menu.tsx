"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Menu,
  Close,
  Info,
  Edit,
  Reading,
  Settings,
  Shield,
  Profile,
  Friends,
} from "@/components/margin-icons";
import { Copyright } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreview } from "@/features/local-preview/provider";
import { useMember } from "@/features/social/member-provider";
import { AccountControls } from "@/features/account/account-controls";

/** Account utilities use a disclosure with ordinary links and tab order. */
export function ProfileMenu({ avatar }: { avatar: ReactNode }) {
  const preview = usePreview();
  const router = useRouter();
  const setPanel = preview.setHeaderPanel;
  const changeOpen = useCallback(
    (open: boolean) =>
      setPanel((current) =>
        open ? "profile" : current === "profile" ? null : current,
      ),
    [setPanel],
  );
  return (
    <AccountMenu
      avatar={avatar}
      open={preview.headerPanel === "profile"}
      onOpenChange={changeOpen}
      onEdit={() => {
        preview.requestProfileEdit();
        router.push("/?view=profile", { scroll: false });
      }}
    />
  );
}

/** The same disclosure, with real member destinations and no preview context. */
export function LiveProfileMenu({ avatar }: { avatar: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <AccountMenu live avatar={avatar} open={open} onOpenChange={setOpen} />
  );
}

function AccountMenu({
  avatar,
  open,
  onOpenChange,
  onEdit,
  live = false,
}: {
  avatar: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  live?: boolean;
}) {
  const member = useMember();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds || !panel.current) return;
      panel.current.style.setProperty(
        "--profile-menu-top",
        `${bounds.bottom + 12}px`,
      );
      panel.current.style.setProperty(
        "--profile-menu-right",
        `${Math.max(16, innerWidth - bounds.right)}px`,
      );
    };
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, { passive: true });
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position);
    };
  }, [open]);
  const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => first.current?.focus());
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !root.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      )
        onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);
  const close = () => onOpenChange(false);
  return (
    <div
      className="margin-profile-menu-root"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !panel.current?.contains(event.relatedTarget)
        )
          close();
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        size="icon"
        className="margin-header-profile"
        aria-label="Profile menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
      >
        {open ? (
          <Close className="margin-header-menu-icon" />
        ) : (
          <Menu className="margin-header-menu-icon" />
        )}
        <span className="margin-header-menu-avatar">{avatar}</span>
      </Button>
      {open &&
        createPortal(
          <nav
            ref={panel}
            id={id}
            aria-label="Profile menu"
            className="margin-profile-menu"
            data-profile-menu
          >
            <Link
              ref={first}
              href={live ? "/app" : "/?view=profile"}
              prefetch={live ? false : undefined}
              onClick={close}
            >
              <Profile aria-hidden="true" />
              View profile
            </Link>
            {live && (
              <Link
                href="/app?edit=1"
                prefetch={false}
                onClick={() => {
                  member?.requestProfileEdit();
                  close();
                }}
              >
                <Edit aria-hidden="true" />
                Edit profile
              </Link>
            )}
            {!live && (
              <button
                type="button"
                onClick={() => {
                  close();
                  onEdit?.();
                }}
              >
                <Edit aria-hidden="true" />
                Edit profile
              </button>
            )}
            <Link
              href={live ? "/app/friends" : "/?view=friends"}
              prefetch={live ? false : undefined}
              onClick={close}
            >
              <Friends aria-hidden="true" />
              Friends
            </Link>
            {
              <Link
                href={live ? "/app/settings" : "/?view=settings"}
                prefetch={live ? false : undefined}
                onClick={close}
              >
                <Settings aria-hidden="true" />
                Settings
              </Link>
            }
            <div className="margin-profile-menu-utilities">
              <Link href="/help" onClick={close}>
                <Info aria-hidden="true" />
                Help &amp; safety
              </Link>
              <Link href="/privacy" onClick={close}>
                <Shield aria-hidden="true" />
                Privacy
              </Link>
              <Link href="/terms" onClick={close}>
                <Reading aria-hidden="true" />
                Terms
              </Link>
              <Link href="/copyright" onClick={close}>
                <Copyright aria-hidden="true" />
                Copyright
              </Link>
            </div>
            <AccountControls compact />
          </nav>,
          document.body,
        )}
    </div>
  );
}
