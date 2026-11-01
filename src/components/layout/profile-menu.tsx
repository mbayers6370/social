"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  CircleHelp,
  Copyright,
  Pencil,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreview } from "@/features/local-preview/provider";
import { AccountControls } from "@/features/account/account-controls";

/** Account utilities use a disclosure with ordinary links and tab order. */
export function ProfileMenu({ avatar }: { avatar: ReactNode }) {
  const preview = usePreview();
  const router = useRouter();
  const open = preview.headerPanel === "profile";
  const setPanel = preview.setHeaderPanel;
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
        setPanel((current) => (current === "profile" ? null : current));
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPanel((current) => (current === "profile" ? null : current));
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, setPanel]);
  const close = () =>
    setPanel((current) => (current === "profile" ? null : current));
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
        onClick={() =>
          setPanel((current) => (current === "profile" ? null : "profile"))
        }
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setPanel("profile");
          }
        }}
      >
        <svg
          className="margin-header-menu-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
          focusable="false"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path data-line="top" d="M4 12h16" />
          <path data-line="middle" d="M4 12h16" />
          <path data-line="bottom" d="M4 12h16" />
        </svg>
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
            <Link ref={first} href="/?view=profile" onClick={close}>
              <UserRound aria-hidden="true" />
              View profile
            </Link>
            <button
              type="button"
              onClick={() => {
                close();
                preview.requestProfileEdit();
                router.push("/?view=profile", { scroll: false });
              }}
            >
              <Pencil aria-hidden="true" />
              Edit profile
            </button>
            <Link href="/?view=friends" onClick={close}>
              <Users aria-hidden="true" />
              Friends
            </Link>
            <Link href="/?view=settings" onClick={close}>
              <Settings2 aria-hidden="true" />
              Settings
            </Link>
            <div className="margin-profile-menu-utilities">
              <Link href="/help" onClick={close}>
                <CircleHelp aria-hidden="true" />
                Help &amp; safety
              </Link>
              <Link href="/privacy" onClick={close}>
                <ShieldCheck aria-hidden="true" />
                Privacy
              </Link>
              <Link href="/terms" onClick={close}>
                <ScrollText aria-hidden="true" />
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
